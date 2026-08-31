require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.CLIENT_URL ? [process.env.CLIENT_URL] : true,
  credentials: false
}));
app.use(express.json({limit:"1mb"}));
app.use(express.urlencoded({extended:true}));
app.use(morgan("tiny"));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 250,
  standardHeaders: "draft-8",
  legacyHeaders: false
});
app.use("/api", apiLimiter);

const businessSchema = new mongoose.Schema({
  name:{type:String,required:true,trim:true,maxlength:120},
  category:{type:String,required:true,trim:true,maxlength:80},
  city:{type:String,required:true,trim:true,maxlength:80},
  suburb:{type:String,default:"",trim:true,maxlength:80},
  phone:{type:String,default:"",trim:true,maxlength:30},
  whatsapp:{type:String,default:"",trim:true,maxlength:30},
  description:{type:String,default:"",trim:true,maxlength:600},
  image:{type:String,default:""},
  logoEmoji:{type:String,default:"🏪"},
  emoji:{type:String,default:"🏪"},
  rating:{type:Number,default:0,min:0,max:5},
  reviews:{type:Number,default:0,min:0},
  price:{type:String,default:"$$"},
  isOpen:{type:Boolean,default:true},
  isVerified:{type:Boolean,default:false},
  isPremium:{type:Boolean,default:false},
  hasWa:{type:Boolean,default:false},
  hasDeals:{type:Boolean,default:false},
  isTop:{type:Boolean,default:false},
  isTrending:{type:Boolean,default:false},
  isNew:{type:Boolean,default:true},
  tags:{type:[String],default:[]},
  services:{type:[String],default:[]},
  hours:{type:Object,default:()=>({mon:"08:00–17:00",tue:"08:00–17:00",wed:"08:00–17:00",thu:"08:00–17:00",fri:"08:00–17:00",sat:"09:00–13:00",sun:"Closed"})},
  lat:{type:Number,default:-17.8252},
  lng:{type:Number,default:31.0335},
  clicks:{type:Number,default:0},
  status:{type:String,enum:["pending","approved","rejected"],default:"approved"}
},{timestamps:true});

businessSchema.index({name:"text",category:"text",city:"text",suburb:"text",description:"text",tags:"text"});

const quoteSchema = new mongoose.Schema({
  businessId:{type:mongoose.Schema.Types.ObjectId,ref:"Business",required:true},
  service:{type:String,required:true,trim:true,maxlength:120},
  description:{type:String,default:"",trim:true,maxlength:1000},
  budget:{type:String,default:"",trim:true,maxlength:80},
  location:{type:String,default:"",trim:true,maxlength:120},
  phone:{type:String,required:true,trim:true,maxlength:30},
  preferredDate:{type:String,default:""},
  status:{type:String,enum:["new","contacted","closed"],default:"new"}
},{timestamps:true});

const bookingSchema = new mongoose.Schema({
  businessId:{type:mongoose.Schema.Types.ObjectId,ref:"Business",required:true},
  service:{type:String,required:true,trim:true,maxlength:120},
  date:{type:String,required:true},
  time:{type:String,required:true},
  name:{type:String,required:true,trim:true,maxlength:120},
  phone:{type:String,required:true,trim:true,maxlength:30},
  status:{type:String,enum:["requested","confirmed","cancelled"],default:"requested"}
},{timestamps:true});

const reviewSchema = new mongoose.Schema({
  businessId:{type:mongoose.Schema.Types.ObjectId,ref:"Business",required:true},
  name:{type:String,required:true,trim:true,maxlength:80},
  rating:{type:Number,required:true,min:1,max:5},
  text:{type:String,required:true,trim:true,maxlength:800}
},{timestamps:true});

const Business = mongoose.model("Business",businessSchema);
const Quote = mongoose.model("Quote",quoteSchema);
const Booking = mongoose.model("Booking",bookingSchema);
const Review = mongoose.model("Review",reviewSchema);

function normalizeBusiness(b){
  return {
    ...b,
    id: String(b._id),
    desc:b.description || "",
    bg:"#eee8ff",
    signal:"var(--aubergine)",
    hasWa:!!b.hasWa,
    reviews:Number(b.reviews||0)
  };
}

app.get("/api/health",(req,res)=>res.json({ok:true,service:"zimbiz-api"}));

app.get("/api/stats",async(req,res)=>{
  try{
    const [businesses,categories,cities,reviews,quotes] = await Promise.all([
      Business.countDocuments({status:"approved"}),
      Business.distinct("category",{status:"approved"}),
      Business.distinct("city",{status:"approved"}),
      Review.countDocuments(),
      Quote.countDocuments()
    ]);
    res.json({businesses,categories:categories.length,cities:cities.length,reviews,quotes});
  }catch(err){res.status(500).json({error:"Unable to load stats"});}
});

app.get("/api/businesses",async(req,res)=>{
  try{
    const {
      q="",city="",category="",open="",verified="",whatsapp="",deals="",top="",
      limit="24",skip="0",sort="recommended"
    } = req.query;

    const filter={status:"approved"};
    const queryText=String(q).trim();
    const filters=[];

    if(queryText){
      filters.push({$or:[
        {name:{$regex:queryText,$options:"i"}},
        {category:{$regex:queryText,$options:"i"}},
        {city:{$regex:queryText,$options:"i"}},
        {suburb:{$regex:queryText,$options:"i"}},
        {description:{$regex:queryText,$options:"i"}},
        {tags:{$elemMatch:{$regex:queryText,$options:"i"}}}
      ]});
    }
    if(city) filter.city={$regex:String(city),$options:"i"};
    if(category) filter.category={$regex:String(category),$options:"i"};
    if(open==="1") filter.isOpen=true;
    if(verified==="1") filter.isVerified=true;
    if(whatsapp==="1") filter.hasWa=true;
    if(deals==="1") filter.hasDeals=true;
    if(top==="1") filter.isTop=true;
    if(filters.length) filter.$and=filters;

    const sortMap={
      recommended:{isPremium:-1,isVerified:-1,rating:-1,reviews:-1},
      rating:{rating:-1,reviews:-1},
      reviews:{reviews:-1},
      new:{createdAt:-1}
    };

    const docs=await Business.find(filter)
      .sort(sortMap[sort]||sortMap.recommended)
      .skip(Math.max(0,Number(skip)||0))
      .limit(Math.min(60,Math.max(1,Number(limit)||24)))
      .lean();

    const total=await Business.countDocuments(filter);
    res.json({items:docs.map(normalizeBusiness),total});
  }catch(err){
    console.error(err);
    res.status(500).json({error:"Unable to load businesses"});
  }
});

app.get("/api/businesses/:id",async(req,res)=>{
  try{
    const b=await Business.findOne({_id:req.params.id,status:"approved"}).lean();
    if(!b) return res.status(404).json({error:"Business not found"});
    const reviews=await Review.find({businessId:b._id}).sort({createdAt:-1}).limit(6).lean();
    res.json({business:normalizeBusiness(b),reviews});
  }catch(err){res.status(404).json({error:"Business not found"});}
});

app.post("/api/businesses",async(req,res)=>{
  try{
    const {name,category,city,phone,whatsapp,description}=req.body||{};
    if(!name||!category||!city||!phone||!description){
      return res.status(400).json({error:"Name, category, city, phone and description are required"});
    }
    const b=await Business.create({
      name,category,city,phone,whatsapp,description,
      hasWa:Boolean(whatsapp),
      status:"pending",
      isNew:true
    });
    res.status(201).json({message:"Listing submitted for review",business:normalizeBusiness(b.toObject())});
  }catch(err){res.status(400).json({error:"Could not create listing"});}
});

app.post("/api/businesses/:id/click",async(req,res)=>{
  try{
    await Business.updateOne({_id:req.params.id},{$inc:{clicks:1}});
    res.json({ok:true});
  }catch(err){res.status(200).json({ok:false});}
});

app.post("/api/quotes",async(req,res)=>{
  try{
    const {businessId,service,description,budget,location,phone,preferredDate}=req.body||{};
    if(!businessId||!service||!phone) return res.status(400).json({error:"Business, service and phone are required"});
    const quote=await Quote.create({businessId,service,description,budget,location,phone,preferredDate});
    res.status(201).json({message:"Quote request received",id:quote._id});
  }catch(err){res.status(400).json({error:"Could not submit quote request"});}
});

app.post("/api/bookings",async(req,res)=>{
  try{
    const {businessId,service,date,time,name,phone}=req.body||{};
    if(!businessId||!service||!date||!time||!name||!phone) return res.status(400).json({error:"Please complete all booking fields"});
    const booking=await Booking.create({businessId,service,date,time,name,phone});
    res.status(201).json({message:"Booking request received",id:booking._id});
  }catch(err){res.status(400).json({error:"Could not submit booking"});}
});

app.post("/api/reviews",async(req,res)=>{
  try{
    const {businessId,name,rating,text}=req.body||{};
    if(!businessId||!name||!rating||!text) return res.status(400).json({error:"All review fields are required"});
    const review=await Review.create({businessId,name,rating,text});
    const stats=await Review.aggregate([
      {$match:{businessId:review.businessId}},
      {$group:{_id:"$businessId",avg:{$avg:"$rating"},count:{$sum:1}}}
    ]);
    if(stats[0]){
      await Business.updateOne({_id:review.businessId},{
        $set:{rating:Number(stats[0].avg.toFixed(1)),reviews:stats[0].count}
      });
    }
    res.status(201).json({message:"Review submitted",review});
  }catch(err){res.status(400).json({error:"Could not submit review"});}
});

app.use(express.static(path.join(__dirname,"public")));
app.get("/{*splat}",(req,res)=>{
  res.sendFile(path.join(__dirname,"public","index.html"));
});

async function start(){
  if(!process.env.MONGODB_URI){
    console.warn("MONGODB_URI not set. API database features will be unavailable.");
    return app.listen(PORT,"0.0.0.0",()=>console.log(`ZimBiz running on http://localhost:${PORT}`));
  }
  try{
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected");
    app.listen(PORT,"0.0.0.0",()=>console.log(`ZimBiz running on http://localhost:${PORT}`));
  }catch(err){
    console.error("MongoDB connection failed:",err.message);
    process.exit(1);
  }
}

start();
