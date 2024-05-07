var db=require('../config/connection')
var collection=require('../config/collections')
const bcrypt=require('bcrypt')
var objectId=require('mongodb').ObjectID
module.exports={
    doSignup:(userData)=>{
        return new Promise(async(resolve,reject)=>{
            userData.Password=await bcrypt.hash(userData.Password,10)
        db.get().collection(collection.USER_COLLECTION).insertOne(userData).then((data)=>{
            resolve(data.ops[0])
        })
             
    }) 
    },
    doLogin:(userData)=>{
        return new Promise(async(resolve,reject)=>{
            let loginStatus=false
            let response={}
            let user=await db.get().collection(collection.USER_COLLECTION).findOne({Email:userData.Email})
            if(user){
                 bcrypt.compare(userData.Password,user.Password).then((status)=>{
                    if(status){
                        console.log('Login Succsess')
                        response.user=user
                        response.status=true
                        resolve(response)
                    }else{
                        console.log('Wrong password entered')
                        resolve({status:false})
                    }
                 })
            }else{
                console.log('No user in this email id')
                resolve({status:false})
            }
        })
    },
    addToCart:(proId,userId)=>{
        return new Promise(async (resolve,reject)=>{
            let userCart=await db.get().collection(collection.CART_COLLECTION).findOne({user:objectId(userId)})
            if(userCart){
                db.get().collection(collection.CART_COLLECTION).
                updateOne({user:objectId(userId)},
                {
                    
                        $push:{products:objectId(proId)}
                    
                }
            ).then((response)=>{
             
                resolve()
            })    
            }else{
                let cartObj={
                    user:objectId(userId),
                    products:[objectId(proId)]
                }
                db.get().collection(collection.CART_COLLECTION).insertOne(cartObj).then((response)=>{
                    resolve()
                })
            }
        })

    },
    getCartProducts:(userId)=>{
     
        return new Promise(async(resolve,reject)=>{
          let cartItems = await db.get().collection(collection.CART_COLLECTION).aggregate([
            {
                $match: { user: objectId(userId) }
            }
           
        ])
        .toArray();
            resolve (cartItems[0].products);
       
        });
      },
      getCartProducts: (userId) => {
        return new Promise(async (resolve, reject) => {
            let cartItems = await db.get().collection(collection.CART_COLLECTION).aggregate([
                {
                    $match: { user: objectId(userId) }
                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        let: { prodList: '$products' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $in: ['$_id', '$$prodList']
                                    },
                                },
                            },
                        ],
                        as: 'cartItem'
                    }
                }
            ]).toArray();
            resolve(cartItems[0].cartItem);
        });
    }
    
      }

       
