const fs=require('fs')
const path=require('path')
const crypto=require('crypto')

const hasFirebase=process.env.FIREBASE_API_KEY&&
                    process.env.FIREBASE_AUTH_DOMAIN&&
                    process.env.FIREBASE_PROJECT_ID

let db
if(hasFirebase){
    const admin=require('firebase-admin')
    
    try{
        const serviceAccount={
            projectId:process.env.FIREBASE_PROJECT_ID,
            privateKey:process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,'\n'),
            clientEmail:process.env.FIREBASE_CLIENT_EMAIL
        }

        admin.initializeApp({
            credential:admin.credential.cert(serviceAccount)
        })

        db=admin.firestore()
        console.log('Firebase initialized')
    }catch(error){
        console.error('Firebase initialization failed:',error)
        db=null
    }
}

const DATA_FILE=path.join('/tmp','irolinks_data.json')
const SESSIONS_FILE=path.join('/tmp','irolinks_sessions.json')

const SESSION_DURATION=60
const REMEMBER_ME_DURATION=10080

function loadData(){
    try{
        if(fs.existsSync(DATA_FILE)){
            const data=fs.readFileSync(DATA_FILE,'utf8')
            return JSON.parse(data)
        }
    }catch(error){
        console.error('Error loading data:',error)
    }
    return{users:{},links:{}}
}

function loadSessions(){
    try{
        if(fs.existsSync(SESSIONS_FILE)){
            const data=fs.readFileSync(SESSIONS_FILE,'utf8')
            return JSON.parse(data)
        }
    }catch(error){
        console.error('Error loading sessions:',error)
    }
    return{sessions:{}}
}

function saveData(data){
    try{
        fs.writeFileSync(DATA_FILE,JSON.stringify(data,null,2))
        return true
    }catch(error){
        console.error('Error saving data:',error)
        return false
    }
}

function saveSessions(sessions){
    try{
        fs.writeFileSync(SESSIONS_FILE,JSON.stringify(sessions,null,2))
        return true
    }catch(error){
        console.error('Error saving sessions:',error)
        return false
    }
}

function generateShortId(){
    const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result=''
    for(let i=0;i<6;i++){
        result+=chars.charAt(Math.floor(Math.random()*chars.length))
    }
    return result
}

function generateSessionToken(){
    return crypto.randomBytes(32).toString('hex')
}

function cleanExpiredSessions(sessions){
    const now=Date.now()
    const cleanedSessions={}
    
    Object.keys(sessions).forEach(token=>{
        const session=sessions[token]
        if(session.expiresAt>now){
            cleanedSessions[token]=session
        }
    })
    
    return cleanedSessions
}

function createSession(userId,rememberMe=false){
    const sessions=loadSessions()
    
    sessions.sessions=cleanExpiredSessions(sessions.sessions||{})
    
    const token=generateSessionToken()
    const expiresAt=Date.now()+(rememberMe?REMEMBER_ME_DURATION:SESSION_DURATION)*60000
    
    sessions.sessions[token]={
        userId,
        expiresAt,
        createdAt:new Date().toISOString(),
        lastActive:Date.now(),
        rememberMe
    }
    
    saveSessions(sessions)
    return token
}

function validateSession(token,userId){
    const sessions=loadSessions()
    
    sessions.sessions=cleanExpiredSessions(sessions.sessions||{})
    saveSessions(sessions)
    
    const session=sessions.sessions?.[token]
    
    if(!session){
        return{valid:false}
    }
    
    if(session.userId!==userId){
        return{valid:false}
    }
    
    if(session.expiresAt<=Date.now()){
        delete sessions.sessions[token]
        saveSessions(sessions)
        return{valid:false}
    }
    
    session.lastActive=Date.now()
    sessions.sessions[token]=session
    saveSessions(sessions)
    
    return{
        valid:true,
        session
    }
}

function destroySession(token){
    const sessions=loadSessions()
    
    if(sessions.sessions?.[token]){
        delete sessions.sessions[token]
        saveSessions(sessions)
        return true
    }
    
    return false
}

async function firebaseSignup(id,password){
    try{
        const usersRef=db.collection('users')
        const snapshot=await usersRef.where('id','==',id).get()
        
        if(!snapshot.empty){
            return{success:false,message:'Username already exists'}
        }
        
        const hashedPassword=crypto.createHash('sha256').update(password).digest('hex')
        
        const userRef=usersRef.doc()
        await userRef.set({
            id,
            password:hashedPassword,
            createdAt:new Date().toISOString(),
            links:[]
        })
        
        return{success:true}
    }catch(error){
        console.error('Firebase signup error:',error)
        return{success:false,message:'Database error'}
    }
}

async function firebaseLogin(id,password,rememberMe=false){
    try{
        const usersRef=db.collection('users')
        
        const hashedPassword=crypto.createHash('sha256').update(password).digest('hex')
        
        const snapshot=await usersRef.where('id','==',id).where('password','==',hashedPassword).get()
        
        if(snapshot.empty){
            return{success:false,message:'Invalid credentials'}
        }
        
        const userDoc=snapshot.docs[0]
        const linksSnapshot=await db.collection('links')
            .where('userId','==',userDoc.id)
            .get()
        
        const token=createSession(id,rememberMe)
        
        return{
            success:true,
            token,
            links:linksSnapshot.size,
            expiryMinutes:rememberMe?REMEMBER_ME_DURATION:SESSION_DURATION
        }
    }catch(error){
        console.error('Firebase login error:',error)
        return{success:false,message:'Database error'}
    }
}

async function firebaseGetUserLinks(userId){
    try{
        const linksRef=db.collection('links')
        const snapshot=await linksRef.where('userId','==',userId)
            .orderBy('createdAt','desc')
            .limit(10)
            .get()
        
        const links=[]
        snapshot.forEach(doc=>{
            const data=doc.data()
            links.push({
                shortId:data.shortId,
                longUrl:data.longUrl,
                clicks:data.clicks||0,
                createdAt:data.createdAt
            })
        })
        
        return{
            success:true,
            links
        }
    }catch(error){
        console.error('Firebase get user links error:',error)
        return{success:false,message:'Database error'}
    }
}

async function firebaseShortenUrl(userId,longUrl){
    try{
        const usersRef=db.collection('users')
        const userSnapshot=await usersRef.where('id','==',userId).get()
        
        if(userSnapshot.empty){
            return{success:false,message:'User not found'}
        }
        
        const userDoc=userSnapshot.docs[0]
        const shortId=generateShortId()
        
        const linksRef=db.collection('links')
        await linksRef.doc(shortId).set({
            shortId,
            longUrl,
            userId:userDoc.id,
            createdAt:new Date().toISOString(),
            clicks:0
        })
        
        await userDoc.ref.update({
            links:admin.firestore.FieldValue.arrayUnion(shortId)
        })
        
        const userLinksSnapshot=await linksRef.where('userId','==',userDoc.id).get()
        
        return{
            success:true,
            shortId,
            totalLinks:userLinksSnapshot.size
        }
    }catch(error){
        console.error('Firebase shorten URL error:',error)
        return{success:false,message:'Database error'}
    }
}

function jsonSignup(id,password){
    const data=loadData()
    
    if(data.users[id]){
        return{success:false,message:'Username already exists'}
    }
    
    const hashedPassword=crypto.createHash('sha256').update(password).digest('hex')
    
    data.users[id]={
        password:hashedPassword,
        createdAt:new Date().toISOString(),
        links:[]
    }
    
    const success=saveData(data)
    return{success}
}

function jsonLogin(id,password,rememberMe=false){
    const data=loadData()
    
    const hashedPassword=crypto.createHash('sha256').update(password).digest('hex')
    
    const user=data.users[id]
    if(!user||user.password!==hashedPassword){
        return{success:false,message:'Invalid credentials'}
    }
    
    const userLinks=Object.values(data.links||{}).filter(link=>link.userId===id)
    
    const token=createSession(id,rememberMe)
    
    return{
        success:true,
        token,
        links:userLinks.length,
        expiryMinutes:rememberMe?REMEMBER_ME_DURATION:SESSION_DURATION
    }
}

function jsonGetUserLinks(userId){
    const data=loadData()
    
    const userLinks=Object.values(data.links||{})
        .filter(link=>link.userId===userId)
        .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))
        .slice(0,10)
        .map(link=>({
            shortId:link.shortId,
            longUrl:link.longUrl,
            clicks:link.clicks||0,
            createdAt:link.createdAt
        }))
    
    return{
        success:true,
        links:userLinks
    }
}

function jsonShortenUrl(userId,longUrl){
    const data=loadData()
    
    if(!data.users[userId]){
        return{success:false,message:'User not found'}
    }
    
    const shortId=generateShortId()
    
    if(!data.links)data.links={}
    data.links[shortId]={
        shortId,
        longUrl,
        userId,
        createdAt:new Date().toISOString(),
        clicks:0
    }
    
    if(!Array.isArray(data.users[userId].links)){
        data.users[userId].links=[]
    }
    data.users[userId].links.push(shortId)
    
    const success=saveData(data)
    if(!success){
        return{success:false,message:'Failed to save link'}
    }
    
    const userLinks=Object.values(data.links).filter(link=>link.userId===userId)
    
    return{
        success:true,
        shortId,
        totalLinks:userLinks.length
    }
}

async function redirectToLongUrl(shortId,updateClick=true){
    if(db){
        try{
            const linkRef=db.collection('links').doc(shortId)
            const doc=await linkRef.get()
            
            if(!doc.exists){
                return null
            }
            
            const linkData=doc.data()
            
            if(updateClick){
                await linkRef.update({
                    clicks:(linkData.clicks||0)+1
                })
            }
            
            return linkData.longUrl
        }catch(error){
            console.error('Firebase redirect error:',error)
            return null
        }
    }else{
        const data=loadData()
        const link=data.links?.[shortId]
        
        if(!link){
            return null
        }
        
        if(updateClick){
            link.clicks=(link.clicks||0)+1
            saveData(data)
        }
        
        return link.longUrl
    }
}

exports.handler=async function(event,context){
    const headers={
        'Content-Type':'application/json',
        'Access-Control-Allow-Origin':'*',
        'Access-Control-Allow-Headers':'Content-Type',
        'Access-Control-Allow-Methods':'GET,POST,OPTIONS'
    }

    if(event.httpMethod==='OPTIONS'){
        return{
            statusCode:200,
            headers,
            body:''
        }
    }

    if(event.httpMethod==='GET'){
        const shortId=event.queryStringParameters?.id
        const direct=event.queryStringParameters?.direct
        
        if(shortId){
            if(direct==='true'){
                const longUrl=await redirectToLongUrl(shortId,true)
                
                if(longUrl){
                    return{
                        statusCode:302,
                        headers:{
                            'Location':longUrl,
                            'Cache-Control':'no-cache'
                        },
                        body:''
                    }
                }else{
                    return{
                        statusCode:404,
                        headers:{
                            'Content-Type':'text/html'
                        },
                        body:'<h1>404 - Link Not Found</h1><p>The requested short link does not exist.</p>'
                    }
                }
            }else{
                const longUrl=await redirectToLongUrl(shortId,false)
                
                if(longUrl){
                    const countdownPage=`
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Redirecting - IROLINKS</title>
                        <style>
                            *{margin:0;padding:0;box-sizing:border-box;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif}
                            body{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;display:flex;justify-content:center;align-items:center;padding:20px}
                            .container{background:white;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-width:500px;padding:40px;text-align:center}
                            .logo{font-size:2.5rem;font-weight:800;background:linear-gradient(45deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:20px}
                            .countdown-box{background:#f8f9fa;border-radius:15px;padding:30px;margin:30px 0}
                            .countdown-number{font-size:4rem;font-weight:800;color:#667eea;margin:20px 0}
                            .destination-url{background:#e9ecef;padding:15px;border-radius:10px;margin:20px 0;word-break:break-all}
                            .progress-bar{width:100%;height:6px;background:#e0e0e0;border-radius:3px;margin-top:20px;overflow:hidden}
                            .progress-fill{height:100%;background:linear-gradient(90deg,#667eea,#764ba2);width:0%;transition:width 1s linear}
                            .info-box{background:#e7f3ff;border-left:4px solid #667eea;padding:15px;margin:20px 0;text-align:left;border-radius:0 10px 10px 0}
                            .footer{margin-top:30px;color:#666;font-size:0.8rem}
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="logo">IROLINKS</div>
                            <h2>You are being redirected</h2>
                            <div class="countdown-box">
                                <div>Redirecting in <span class="countdown-number" id="countdown">10</span> seconds</div>
                                <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
                            </div>
                            <div class="info-box">
                                <h4>Safety Notice:</h4>
                                <p>We're redirecting you to an external website.</p>
                            </div>
                            <p>Destination URL:</p>
                            <div class="destination-url" id="destinationUrl">${longUrl}</div>
                            <div class="footer">
                                <p>Powered by IROLINKS | <a href="https://github.com/IROTECHLAB/irolinks" target="_blank">Open Source</a></p>
                                <p>Made by Deepseek & IRONMAN</p>
                            </div>
                        </div>
                        <script>
                            let countdown=10
                            let countdownInterval
                            const destinationUrl="${longUrl}"
                            function updateCountdown(){
                                const countdownElement=document.getElementById('countdown')
                                const progressFill=document.getElementById('progressFill')
                                countdownElement.textContent=countdown
                                const progressPercentage=((10-countdown)/10)*100
                                progressFill.style.width=progressPercentage+'%'
                                if(countdown<=0){
                                    clearInterval(countdownInterval)
                                    window.location.href='/.netlify/functions/link?id=${shortId}&direct=true'
                                }
                                countdown--
                            }
                            countdownInterval=setInterval(updateCountdown,1000)
                        </script>
                    </body>
                    </html>`
                    
                    return{
                        statusCode:200,
                        headers:{
                            'Content-Type':'text/html',
                            'Cache-Control':'no-cache'
                        },
                        body:countdownPage
                    }
                }else{
                    return{
                        statusCode:404,
                        headers:{
                            'Content-Type':'text/html'
                        },
                        body:'<h1>404 - Link Not Found</h1><p>The requested short link does not exist.</p>'
                    }
                }
            }
        }
        
        return{
            statusCode:400,
            headers,
            body:JSON.stringify({success:false,message:'No short ID provided'})
        }
    }

    if(event.httpMethod==='POST'){
        try{
            const body=JSON.parse(event.body)
            const{action}=body
            
            let result
            
            switch(action){
                case'signup':
                    if(db){
                        result=await firebaseSignup(body.id,body.password)
                    }else{
                        result=jsonSignup(body.id,body.password)
                    }
                    break
                    
                case'login':
                    if(db){
                        result=await firebaseLogin(body.id,body.password,body.rememberMe)
                    }else{
                        result=jsonLogin(body.id,body.password,body.rememberMe)
                    }
                    break
                    
                case'validate_session':
                    const sessionValidation=validateSession(body.token,body.userId)
                    if(sessionValidation.valid){
                        result={
                            success:true,
                            expiryMinutes:Math.floor((sessionValidation.session.expiresAt-Date.now())/60000)
                        }
                    }else{
                        result={success:false,message:'Invalid or expired session'}
                    }
                    break
                    
                case'get_user_links':
                    const linkSession=validateSession(body.token,body.userId)
                    if(!linkSession.valid){
                        result={success:false,message:'Invalid session'}
                        break
                    }
                    
                    if(db){
                        result=await firebaseGetUserLinks(body.userId)
                    }else{
                        result=jsonGetUserLinks(body.userId)
                    }
                    break
                    
                case'shorten':
                    const shortenSession=validateSession(body.token,body.userId)
                    if(!shortenSession.valid){
                        result={success:false,message:'Invalid session. Please login again.'}
                        break
                    }
                    
                    if(db){
                        result=await firebaseShortenUrl(body.userId,body.longUrl)
                    }else{
                        result=jsonShortenUrl(body.userId,body.longUrl)
                    }
                    break
                    
                case'logout':
                    destroySession(body.token)
                    result={success:true}
                    break
                    
                default:
                    result={success:false,message:'Invalid action'}
            }
            
            return{
                statusCode:200,
                headers,
                body:JSON.stringify(result)
            }
            
        }catch(error){
            console.error('Handler error:',error)
            return{
                statusCode:500,
                headers,
                body:JSON.stringify({ 
                    success:false, 
                    message:'Internal server error' 
                })
            }
        }
    }
    
    return{
        statusCode:405,
        headers,
        body:JSON.stringify({success:false,message:'Method not allowed'})
    }
}