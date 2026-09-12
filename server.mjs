
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import bcrypt from "bcryptjs";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set("trust proxy", 1);

const {
  PORT=3000, DATABASE_URL, ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD,
  SESSION_SECRET, S3_ENDPOINT, S3_REGION="auto", S3_BUCKET,
  S3_ACCESS_KEY, S3_SECRET_KEY, S3_PUBLIC_BASE_URL,
  NODE_ENV="production"
} = process.env;

if (!DATABASE_URL || !SESSION_SECRET || !S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY || !S3_SECRET_KEY || !S3_PUBLIC_BASE_URL) {
  console.warn("Production config is incomplete. Check .env.example.");
}

const pool = new pg.Pool({connectionString:DATABASE_URL, ssl:NODE_ENV==="production"?{rejectUnauthorized:false}:false});
const PgStore = connectPgSimple(session);
const s3 = new S3Client({
  region:S3_REGION,
  endpoint:S3_ENDPOINT,
  forcePathStyle:false,
  credentials:{accessKeyId:S3_ACCESS_KEY,secretAccessKey:S3_SECRET_KEY}
});

app.use(helmet({crossOriginResourcePolicy:{policy:"cross-origin"}}));
app.use(express.json({limit:"2mb"}));
app.use(express.urlencoded({extended:true}));
app.use(rateLimit({windowMs:15*60*1000,max:300,standardHeaders:true,legacyHeaders:false}));
app.use(session({
  store:new PgStore({pool,tableName:"user_sessions",createTableIfMissing:true}),
  secret:SESSION_SECRET,resave:false,saveUninitialized:false,
  cookie:{httpOnly:true,sameSite:"lax",secure:NODE_ENV==="production",maxAge:8*60*60*1000}
}));
app.use(express.static(__dirname,{index:"index.html"}));

const schema = `
CREATE TABLE IF NOT EXISTS public.influencers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 name TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'AI Creator',
 image_url TEXT NOT NULL DEFAULT '',
 video_url TEXT NOT NULL DEFAULT '',
 active BOOLEAN NOT NULL DEFAULT TRUE,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

async function init(){
  const schemaPath = process.env.REVA_SCHEMA_PATH || path.join(__dirname,"supabase","schema.sql");
  try {
    const fs = await import("fs/promises");
    const master = await fs.readFile(schemaPath,"utf8");
    await pool.query(master);
  } catch (e) {
    console.warn("Master schema was not applied automatically:", e.message);
  }
  await pool.query(schema);
  if(ADMIN_SEED_EMAIL && ADMIN_SEED_PASSWORD){
    const exists=await pool.query("SELECT 1 FROM public.admins WHERE lower(email)=lower($1)",[ADMIN_SEED_EMAIL]);
    if(!exists.rowCount){
      const hash=await bcrypt.hash(ADMIN_SEED_PASSWORD,12);
      await pool.query("INSERT INTO public.admins(id,email,password_hash,role,is_active) VALUES(gen_random_uuid(),$1,$2,'owner',true)",[ADMIN_SEED_EMAIL.toLowerCase(),hash]);
      console.log("Seed owner created.");
    }
  }
}
const roles={owner:4,editor:3,media:2,viewer:1};
function auth(req,res,next){if(req.session.admin)return next();res.status(401).json({error:"Unauthorized"});}
function permit(...allowed){return (req,res,next)=>{if(req.session.admin && allowed.includes(req.session.admin.role))return next();res.status(403).json({error:"Forbidden"});};}
async function audit(req,action,type,id,details={}){try{await pool.query("INSERT INTO public.audit_log(tenant_id,actor_auth_user_id,actor_admin_id,action,entity_type,entity_id,after_data) VALUES($1,$2,$3,$4,$5)",[null,null,req.session.admin.id,action,type,id,details]);}catch{}}

app.post("/api/login",rateLimit({windowMs:10*60*1000,max:20}),async(req,res)=>{
 const {email,password}=req.body||{};
 const q=await pool.query("SELECT * FROM admins WHERE lower(email)=lower($1) AND is_active=true",[String(email||"").toLowerCase()]);
 if(!q.rowCount || !(await bcrypt.compare(password||"",q.rows[0].password_hash)))return res.status(401).json({error:"Invalid credentials"});
 const a=q.rows[0]; req.session.admin={id:a.id,email:a.email,role:a.role}; await audit(req,"login","admin",a.id);res.json({ok:true,admin:{email:a.email,role:a.role}});
});
app.post("/api/logout",auth,async(req,res)=>{await audit(req,"logout","admin",req.session.admin.id);req.session.destroy(()=>res.json({ok:true}));});
app.get("/api/session",(req,res)=>res.json({authenticated:!!req.session.admin,admin:req.session.admin||null}));

app.get("/api/content",async(req,res)=>res.json({}));

app.get("/api/agents",async(req,res)=>{const q=await pool.query("SELECT id,code,name,slug,description,default_language,supported_languages,status,is_public,sort_order FROM public.ai_agents WHERE status='published' AND is_public=true ORDER BY sort_order,id");res.json(q.rows.map(x=>({id:x.id,code:x.code,slug:x.slug,icon:"✦",title:{en:x.name,ar:x.name,fr:x.name},text:{en:x.description||"",ar:x.description||"",fr:x.description||""},supported_languages:x.supported_languages})));});
app.post("/api/agents",auth,permit("owner","editor"),async(req,res)=>{const id=crypto.randomUUID();const a=req.body||{};await pool.query("INSERT INTO public.ai_agents(id,code,name,slug,description,status,is_public) VALUES($1,$2,$3,$4,$5,'published',true)",[id,a.code||a.id||id,a.title?.en||a.name||'New AI Agent',String(a.slug||a.id||id).toLowerCase(),a.text?.en||a.description||'']);res.json({id,...a});});
app.put("/api/agents/:id",auth,permit("owner","editor"),async(req,res)=>{const a=req.body||{};await pool.query("UPDATE public.ai_agents SET name=$1,description=$2,slug=$3,status='published',is_public=true,updated_at=now() WHERE id=$4",[a.title?.en||a.name||'AI Agent',a.text?.en||a.description||'',String(a.slug||a.id||'').toLowerCase(),req.params.id]);res.json({ok:true});});
app.delete("/api/agents/:id",auth,permit("owner"),async(req,res)=>{await pool.query("UPDATE public.ai_agents SET status='archived',is_public=false,updated_at=now() WHERE id=$1",[req.params.id]);res.json({ok:true});});

app.get("/api/products",async(req,res)=>{const q=await pool.query("SELECT id,product_type,sku,name,slug,description,price,currency,status,is_digital,delivery_config,metadata FROM public.products WHERE status='published' ORDER BY created_at DESC");res.json(q.rows);});
app.get("/api/products/:slug",async(req,res)=>{const q=await pool.query("SELECT id,product_type,sku,name,slug,description,price,currency,status,is_digital,delivery_config,metadata FROM public.products WHERE slug=$1 AND status='published'",[req.params.slug]);if(!q.rowCount)return res.status(404).json({error:'Product not found'});res.json(q.rows[0]);});
app.post("/api/products",auth,permit("owner","editor"),async(req,res)=>{const p=req.body||{},id=crypto.randomUUID();await pool.query("INSERT INTO public.products(id,product_type,name,slug,description,price,currency,status,is_digital,delivery_config,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",[id,p.product_type||'digital',p.name||'New Digital Product',String(p.slug||p.name||id).toLowerCase().replace(/[^a-z0-9-]+/g,'-'),p.description||'',p.price??0,p.currency||'USD',p.status||'draft',p.is_digital!==false,p.delivery_config||{},p.metadata||{}]);res.json({id});});
app.put("/api/products/:id",auth,permit("owner","editor"),async(req,res)=>{const p=req.body||{};await pool.query("UPDATE public.products SET name=$1,slug=$2,description=$3,price=$4,currency=$5,status=$6,is_digital=$7,delivery_config=$8,metadata=$9,updated_at=now() WHERE id=$10",[p.name,p.slug,p.description||'',p.price??0,p.currency||'USD',p.status||'draft',p.is_digital!==false,p.delivery_config||{},p.metadata||{},req.params.id]);res.json({ok:true});});

app.get("/api/pages",async(req,res)=>{
 const q=await pool.query("SELECT id,slug,language_code,title,status,is_public,sort_order FROM public.pages WHERE status='published' AND is_public=true ORDER BY sort_order,slug,language_code");
 const map={};
 for(const x of q.rows){map[x.slug] ||= {id:x.id,slug:x.slug,title:{},body:{}}; map[x.slug].title[x.language_code]=x.title;}
 for(const [slug,p] of Object.entries(map)){const s=await pool.query("SELECT ps.body,p.language_code FROM public.page_sections ps JOIN public.pages p ON p.id=ps.page_id WHERE p.slug=$1 AND ps.section_key='main' AND ps.status='published'",[slug]);for(const x of s.rows)p.body[x.language_code]=x.body||'';}
 res.json(Object.values(map));
});
app.get("/api/pages/:slug",async(req,res)=>{
 const q=await pool.query("SELECT id,slug,language_code,title,status,is_public FROM public.pages WHERE slug=$1 AND status='published' AND is_public=true ORDER BY language_code",[req.params.slug]);
 if(!q.rowCount)return res.status(404).json({error:'Page not found'});
 const out={id:q.rows[0].id,slug:req.params.slug,title:{},body:{}}; for(const x of q.rows)out.title[x.language_code]=x.title;
 const s=await pool.query("SELECT ps.body,p.language_code FROM public.page_sections ps JOIN public.pages p ON p.id=ps.page_id WHERE p.slug=$1 AND ps.section_key='main'",[req.params.slug]); for(const x of s.rows)out.body[x.language_code]=x.body||'';
 res.json(out);
});
app.get("/api/pages/all",auth,permit("owner","editor"),async(req,res)=>{
 const q=await pool.query("SELECT id,slug,language_code,title,status,is_public,sort_order FROM public.pages ORDER BY slug,language_code"); const map={};
 for(const x of q.rows){map[x.slug] ||= {id:x.id,slug:x.slug,title:{},body:{},published:x.status==='published',template:'standard'};map[x.slug].title[x.language_code]=x.title;}
 for(const [slug,p] of Object.entries(map)){const s=await pool.query("SELECT ps.body,p.language_code FROM public.page_sections ps JOIN public.pages p ON p.id=ps.page_id WHERE p.slug=$1 AND ps.section_key='main'",[slug]);for(const x of s.rows)p.body[x.language_code]=x.body||'';}
 res.json(Object.values(map));
});
app.post("/api/pages",auth,permit("owner","editor"),async(req,res)=>{
 const p=req.body||{},slug=String(p.slug||'new-page').toLowerCase().trim().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,''); if(!slug)return res.status(400).json({error:'Valid slug required'});
 const titles=p.title||{en:'New Page',ar:'صفحة جديدة',fr:'Nouvelle page'}, bodies=p.body||{en:'',ar:'',fr:''}; let firstId=null;
 const client=await pool.connect(); try{await client.query('BEGIN'); for(const lang of ['en','ar','fr']){const id=crypto.randomUUID();if(lang==='en')firstId=id;await client.query("INSERT INTO public.pages(id,tenant_id,language_code,title,slug,status,is_public) VALUES($1,null,$2,$3,$4,$5,true)",[id,lang,titles[lang]||titles.en||slug,slug,p.published===false?'draft':'published']);await client.query("INSERT INTO public.page_sections(id,page_id,section_key,section_type,title,body,status) VALUES(gen_random_uuid(),$1,'main','content',$2,$3,$4)",[id,titles[lang]||titles.en||slug,bodies[lang]||bodies.en||'',p.published===false?'draft':'published']);} await client.query('COMMIT');res.json({id:firstId,slug,title:titles,body:bodies,published:p.published!==false,template:'standard'});}catch(e){await client.query('ROLLBACK');res.status(409).json({error:'Slug already exists'});}finally{client.release();}
});
app.put("/api/pages/:id",auth,permit("owner","editor"),async(req,res)=>{
 const p=req.body||{},r=await pool.query("SELECT slug FROM public.pages WHERE id=$1",[req.params.id]);if(!r.rowCount)return res.status(404).json({error:'Page not found'});const oldSlug=r.rows[0].slug;const slug=String(p.slug||oldSlug).toLowerCase().trim().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'');const titles=p.title||{},bodies=p.body||{},status=p.published===false?'draft':'published';
 const client=await pool.connect();try{await client.query('BEGIN');await client.query("UPDATE public.pages SET slug=$1,status=$2,is_public=true,updated_at=now() WHERE slug=$3",[slug,status,oldSlug]);for(const lang of ['en','ar','fr']){await client.query("UPDATE public.pages SET title=$1,status=$2,is_public=true,updated_at=now() WHERE slug=$3 AND language_code=$4",[titles[lang]||titles.en||slug,status,slug,lang]);await client.query("INSERT INTO public.page_sections(id,page_id,section_key,section_type,title,body,status) SELECT gen_random_uuid(),id,'main','content',$1,$2,$3 FROM public.pages WHERE slug=$4 AND language_code=$5 ON CONFLICT(page_id,section_key) DO UPDATE SET body=EXCLUDED.body,title=EXCLUDED.title,status=EXCLUDED.status,updated_at=now()",[titles[lang]||titles.en||slug,bodies[lang]||bodies.en||'',status,slug,lang]);}await client.query('COMMIT');res.json({ok:true});}catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message});}finally{client.release();}
});
app.delete("/api/pages/:id",auth,permit("owner"),async(req,res)=>{const r=await pool.query("SELECT slug FROM public.pages WHERE id=$1",[req.params.id]);if(!r.rowCount)return res.status(404).json({error:'Page not found'});await pool.query("DELETE FROM public.pages WHERE slug=$1",[r.rows[0].slug]);res.json({ok:true});});

const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:80*1024*1024},fileFilter:(req,file,cb)=>{const ok=/^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime))$/.test(file.mimetype);cb(null,ok);}});
app.post("/api/media/upload",auth,permit("owner","editor","media"),upload.single("file"),async(req,res)=>{
 if(!req.file)return res.status(400).json({error:"Supported image or video file required"});
 const isVideo=req.file.mimetype.startsWith("video/");
 const folder=isVideo?"influencers/videos":"influencers/images";
 const key=`${folder}/${crypto.randomUUID()}${path.extname(req.file.originalname).toLowerCase()}`;
 await s3.send(new PutObjectCommand({Bucket:S3_BUCKET,Key:key,Body:req.file.buffer,ContentType:req.file.mimetype,CacheControl:"public,max-age=31536000,immutable"}));
 const url=`${S3_PUBLIC_BASE_URL.replace(/\/$/,'')}/${key}`;
 res.json({url,key,type:isVideo?"video":"image",mime:req.file.mimetype});
});
app.delete("/api/media",auth,permit("owner","media"),async(req,res)=>{if(!req.body.key)return res.status(400).json({error:"key required"});await s3.send(new DeleteObjectCommand({Bucket:S3_BUCKET,Key:req.body.key}));res.json({ok:true});});

app.get("/api/pages",async(req,res)=>{const q=await pool.query("SELECT id,slug,title,body,template,published,updated_at FROM pages WHERE published=true ORDER BY updated_at DESC");res.json(q.rows);});
app.get("/api/pages/all",auth,permit("owner","editor"),async(req,res)=>{const q=await pool.query("SELECT id,slug,title,body,template,published,updated_at FROM pages ORDER BY updated_at DESC");res.json(q.rows);});
app.get("/api/pages/:slug",async(req,res)=>{const q=await pool.query("SELECT id,slug,title,body,template,published FROM pages WHERE slug=$1 AND published=true",[req.params.slug]);if(!q.rowCount)return res.status(404).json({error:"Page not found"});res.json(q.rows[0]);});
app.post("/api/pages",auth,permit("owner","editor"),async(req,res)=>{const id=crypto.randomUUID();const slug=String(req.body.slug||"new-page").toLowerCase().trim().replace(/[^a-z0-9-]+/g,"-").replace(/^-|-$/g,"");if(!slug)return res.status(400).json({error:"Valid slug required"});try{await pool.query("INSERT INTO pages(id,slug,title,body,template,published,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7)",[id,slug,req.body.title||{en:"New Page",ar:"صفحة جديدة",fr:"Nouvelle page"},req.body.body||{en:"",ar:"",fr:""},req.body.template||"standard",req.body.published!==false,req.session.admin.id]);await audit(req,"create","page",id,{slug});res.json({id,slug,title:req.body.title||{},body:req.body.body||{},template:req.body.template||"standard",published:req.body.published!==false});}catch(e){res.status(409).json({error:"Slug already exists"});}});
app.put("/api/pages/:id",auth,permit("owner","editor"),async(req,res)=>{const slug=String(req.body.slug||"").toLowerCase().trim().replace(/[^a-z0-9-]+/g,"-").replace(/^-|-$/g,"");if(!slug)return res.status(400).json({error:"Valid slug required"});await pool.query("UPDATE pages SET slug=$1,title=$2,body=$3,template=$4,published=$5,updated_at=now(),updated_by=$6 WHERE id=$7",[slug,req.body.title||{},req.body.body||{},req.body.template||"standard",req.body.published!==false,req.session.admin.id,req.params.id]);await audit(req,"update","page",req.params.id,{slug});res.json({ok:true});});
app.delete("/api/pages/:id",auth,permit("owner"),async(req,res)=>{await pool.query("DELETE FROM pages WHERE id=$1",[req.params.id]);await audit(req,"delete","page",req.params.id);res.json({ok:true});});

app.get("/api/admins",auth,permit("owner"),async(req,res)=>{const q=await pool.query("SELECT id,email,role,is_active AS active,created_at FROM public.admins ORDER BY created_at DESC");res.json(q.rows);});
app.post("/api/admins",auth,permit("owner"),async(req,res)=>{const {email,password,role="viewer"}=req.body||{};if(!email||!password||!roles[role])return res.status(400).json({error:"email, password and valid role required"});const hash=await bcrypt.hash(password,12);try{const id=crypto.randomUUID();await pool.query("INSERT INTO public.admins(id,email,password_hash,role,is_active) VALUES($1,$2,$3,$4,true)",[id,email.toLowerCase(),hash,role]);await audit(req,"create","admin",id,{email,role});res.json({id,email,role});}catch(e){res.status(409).json({error:"Email already exists"});}});
app.patch("/api/admins/:id",auth,permit("owner"),async(req,res)=>{const {role,active,password}=req.body||{};if(role && !roles[role])return res.status(400).json({error:"Invalid role"});const sets=[],vals=[];if(role){sets.push(`role=$${vals.length+1}`);vals.push(role)}if(active!==undefined){sets.push(`is_active=$${vals.length+1}`);vals.push(!!active)}if(password){sets.push(`password_hash=$${vals.length+1}`);vals.push(await bcrypt.hash(password,12))}if(!sets.length)return res.json({ok:true});vals.push(req.params.id);await pool.query(`UPDATE public.admins SET ${sets.join(",")} WHERE id=$${vals.length}`,vals);await audit(req,"update","admin",req.params.id);res.json({ok:true});});

app.get("/api/audit",auth,permit("owner"),async(req,res)=>{const q=await pool.query("SELECT audit_log.*,admins.email FROM audit_log LEFT JOIN admins ON admins.id=audit_log.admin_id ORDER BY audit_log.created_at DESC LIMIT 200");res.json(q.rows);});
app.get("/api/backup",auth,permit("owner"),async(req,res)=>{const [agents,products,pages]=await Promise.all([pool.query("SELECT * FROM public.ai_agents WHERE tenant_id IS NULL ORDER BY sort_order"),pool.query("SELECT * FROM public.products ORDER BY created_at"),pool.query("SELECT id,slug,language_code,title,status,is_public,sort_order FROM public.pages ORDER BY slug,language_code")]);res.json({version:3,exported_at:new Date().toISOString(),agents:agents.rows,products:products.rows,pages:pages.rows});});
app.post("/api/backup",auth,permit("owner"),async(req,res)=>{res.status(501).json({error:"Restore is disabled in this GitHub/Supabase build. Import data through Supabase SQL to avoid accidental destructive changes."});});
app.get("/api/health",async(req,res)=>{try{await pool.query("SELECT 1");res.json({ok:true,db:"up",time:new Date().toISOString()})}catch{res.status(503).json({ok:false})}});

app.get("/admin",(req,res)=>res.sendFile(path.join(__dirname,"admin.html")));
app.get("/p/:slug",(req,res)=>res.sendFile(path.join(__dirname,"page.html")));
init().then(()=>app.listen(PORT,()=>console.log(`REVA production server listening on ${PORT}`))).catch(e=>{console.error(e);process.exit(1)});
