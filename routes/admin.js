var express = require('express');
var router = express.Router();
const adminHelpers=require('../helpers/admin-helpers');
const productHelpers = require('../helpers/product-helpers');
const verifyLogin=(req,res,next)=>{
  if(req.session.adminLoggedIn){
  next()
  }else{
    res.redirect('/admin/login')
  }
}
/* GET users listing. */
router.get('/',verifyLogin, function(req, res, next) {

productHelpers.getAllProducts().then((products)=>{
  console.log(products)
  res.render('admin/view-products',{admin:true,products})
})
});


router.get('/login',(req,res)=>{
  if(req.session.admin){
    res.redirect('/admin/')}
    else{
      res.render('admin/login',{admin:true,"loginErr":req.session.adminLoginErr})
      req.session.adminLoginErr=false
    }
})

router.post('/login',(req,res)=>{
  adminHelpers.doLogin(req.body).then((response)=>{
    if(response.status){
   
      req.session.admin=response.admin
      req.session.adminLoggedIn=true
      res.redirect('/admin/')
    }else{
      req.session.adminLoginErr="Invalid Username or Password"
      res.redirect('/admin/login')
    }
  })
})
router.get('/logout',(req,res)=>{
  req.session.admin=null
  req.session.adminLoggedIn=false
  res.redirect('/admin/login')
})

router.get('/add-product',verifyLogin, function(req,res){
  res.render('admin/add-product',{admin:true}) 
})
router.post('/add-product',(req,res)=>{
  

  productHelpers.addProduct(req.body,(id)=>{
    let image=req.files.Image
    console.log(id)
    image.mv('./public/product-images/'+id+'.jpg',(err)=>{
      if(!err){
        res.render("admin/add-product",{admin:true})
      }else{
        consoele.log(err)
      }

    })
 
  })
})
router.get('/delete-product/:id',verifyLogin, (req,res)=>{
  let proId = req.params.id
  console.log(proId);
  productHelpers.deleteProduct(proId).then((response)=>{
    res.redirect('/admin/')
  })
})

router.get('/edit-product/:id',verifyLogin, async (req,res)=>{
  let product=await productHelpers.getProductDetails(req.params.id)
 console.log(product);
  res.render('admin/edit-product',{product,admin:true})
})
router.post('/edit-product/:id',(req,res)=>{
  let id=req.params.id
  productHelpers.updateProduct(req.params.id,req.body).then(()=>{
    res.redirect('/admin')
    if(req.files.Image){
      let image=req.files.Image
      image.mv('./public/product-images/'+id+'.jpg')
    }
  })
})



module.exports = router;
