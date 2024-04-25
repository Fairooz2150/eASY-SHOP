var express = require('express');
var router = express.Router();
var productHelpers=require('../helpers/product-helpers');

/* GET home page. */
router.get('/', function(req, res, next) {
 

  productHelpers.getAllProducts().then((products)=>{
    console.log(products)
    res.render('user/view-products',{products})
  })
  });
  router.get('/login',(req,res)=>{
    res.render('user/login')
  })
router.get('/signup',(req,res)=>{
  res.render('user/signup')
})
router.post('/signup',(req,res)=>{
  
})
module.exports = router;
