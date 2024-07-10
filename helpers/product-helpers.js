var db=require('../config/connection')
var collection=require('../config/collections')
const { response } = require('express')
const moment = require('moment');
const { log } = require('console')
const path = require('path');
const fs = require('fs'); 

var objectId=require('mongodb').ObjectID
module.exports={

    addProduct: (product) => {
        return new Promise((resolve, reject) => {
            
            db.get().collection(collection.PRODUCT_COLLECTION).insertOne(product).then((data) => {
                resolve(data.insertedId);
                console.log(data.insertedId);
            });
        });
    },
    getCartedProductQuantity:()=>{
        return new Promise(async(resolve,reject)=>{
            let productQuantity=await db.get().collection(collection.CART_COLLECTION).aggregate([
                {
                  $unwind: "$products" // Deconstructs the products array
                },
                {
                  $group: {
                    _id: "$products.item", // Group by item ID
                    totalQuantity: { $sum: "$products.quantity" } // Calculate the total quantity
                  }
                },
                {
                  $project: {
                    _id: 0, // Exclude _id field
                    product_id: "$_id", // Rename _id as product_id
                    totalquantity: "$totalQuantity" // Rename totalQuantity as quantity
                  }
                }
              ]).toArray();
             
              resolve(productQuantity)
              
        })
    },
    getAllProducts:()=>{
        return new Promise(async(resolve,reject)=>{
            
            let products=await db.get().collection(collection.PRODUCT_COLLECTION).find().toArray()
            resolve(products)
        })
    },
    getAllProductswithQuantity: (products, productQuantity) => {
        return new Promise((resolve, reject) => {
            products.forEach(product => {
                const match = productQuantity.find(pq => pq.product_id.equals(product._id));
                if (match) {
                    product.Carted = match.totalquantity;
                } else {
                    product.Carted = 0;
                }
            });
            resolve(products);
        });
    },

    getAllUserProducts: () => {
        return new Promise(async (resolve, reject) => {
          try {
            let products = await db.get().collection(collection.USER_PRODUCTS_COLLECTION)
              .find()
              .sort({ Date: -1, time: -1 }) // Sort by date and time in descending order
              .toArray();
            resolve(products);
          } catch (error) {
            reject(error);
          }
        });
      },
      
    deleteProduct:(prodId)=>{
        return new Promise((resolve,reject)=>{
            console.log(prodId);
            console.log(objectId(prodId));
            db.get().collection(collection.PRODUCT_COLLECTION).removeOne({_id:objectId(prodId)}).then((response)=>{
               //console.log(response);
                resolve(response)
            }).catch((err) => {
                reject(err);
              });
        })
    },
    deleteUserProduct: (prodId) => {
        return new Promise(async (resolve, reject) => {
            try {
                console.log(prodId);
                console.log(objectId(prodId));
                await db.get().collection(collection.USER_PRODUCTS_COLLECTION).removeOne({_id: objectId(prodId)});
                await db.get().collection(collection.PRODUCT_COLLECTION).removeOne({_id: objectId(prodId)});
                await db.get().collection(collection.CART_COLLECTION).updateMany(
                    {},
                    { $pull: { products: { item: objectId(prodId) } } }
                );
                resolve();
            } catch (error) {
                console.error('Error deleting user product:', error);
                reject(error);
            }
        });
    },
    
    deletePendingProduct:(prodId)=>{
        return new Promise((resolve,reject)=>{
            console.log(prodId);
            console.log(objectId(prodId));
           
            db.get().collection(collection.USER_PRODUCTS_COLLECTION).removeOne({_id:objectId(prodId)}).then((response)=>{
               //console.log(response);
                resolve(response)
            }).catch((err) => {
                reject(err);
              });
        })
    },
    getUserProductDetails:(proId)=>{
        return new Promise((resolve,reject)=>{
            db.get().collection(collection.USER_PRODUCTS_COLLECTION).findOne({_id:objectId(proId)}).then((product)=>{
                resolve(product)
            })
        })
    },


    getProductDetails:(proId)=>{
        return new Promise((resolve,reject)=>{
            db.get().collection(collection.PRODUCT_COLLECTION).findOne({_id:objectId(proId)}).then((product)=>{
                if(product==null){
                    db.get().collection(collection.USER_PRODUCTS_COLLECTION).findOne({_id:objectId(proId)}).then((product)=>{
                        resolve(product)
                    })
                }else{
                resolve(product)
                }})
        })
    },
    changeStockCount: (proId) => {
        return new Promise((resolve, reject) => {
          db.get().collection(collection.PRODUCT_COLLECTION)
            .findOneAndUpdate(
              { _id: objectId(proId) },
              [{ $set: { Stock_Count: { $subtract: [{ $toInt: "$Stock_Count" }, 1] } } }],
              { returnOriginal: false }
            )
            .then((result) => {
              if (result.value) {
                resolve(result.value);
              } else {
                reject('Product not found or stock not updated');
              }
            })
            .catch((error) => {
              reject(error);
            });
        });
      },
    
    updateProduct:(proId,proDetails)=>{
        return new Promise((resolve,reject)=>{
            db.get().collection(collection.PRODUCT_COLLECTION).updateOne({_id:objectId(proId)},{
                $set:{
                    Name:proDetails.Name,
                    Description:proDetails.Description,
                    Actual_Price:proDetails.Actual_Price,
                    Offer_Price:proDetails.Offer_Price,
                    Category:proDetails.Category,
                    Offer_Percentage:proDetails.Offer_Percentage,
                    Product_Owner:proDetails.Product_Owner,
                    Stock_Count:proDetails.Stock_Count
                }
            }).then((response)=>{
                resolve()
            })
        })
    },
    updateUserProduct:(proId,product)=>{
        return new Promise((resolve,reject)=>{
            let Date = moment().format('DD MMM YYYY');
            let Time = moment().format('hh:mmA');
            if(product.Status==='Pending'){
                 
                db.get().collection(collection.USER_PRODUCTS_COLLECTION).updateOne({_id:objectId(proId)},{
                    $set:{
                        
                            Name: product.Name,
                            Category: product.Category,
                            Actual_Price: product.Actual_Price,
                            Product_Owner:product.Product_Owner,
                            Offer_Price: product.Offer_Price,
                            Offer_Percentage: product.Offer_Percentage,
                            Description: product.Description,                              
                            Shop_Address:product.Shop_Address,  
                            Stock_Count:product.Stock_Count,   
                            Phone:product.Phone,     
                            Email:product.Email,
                            Whatsapp:product.Whatsapp,                 
                            Carted:product.Carted,
                            Updations:product.Updations,
                            UpdatedDate: Date,
                            UpdatedTime: Time               
                    }
                })
    
            }else{

            db.get().collection(collection.PRODUCT_COLLECTION).updateOne({_id:objectId(proId)},{
                $set:{
                    
                       
                    Name: product.Name,
                    Category: product.Category,
                    Actual_Price: product.Actual_Price,
                    Product_Owner:product.Product_Owner,
                    Offer_Price: product.Offer_Price,
                    Offer_Percentage: product.Offer_Percentage,
                    Description: product.Description,                              
                    Shop_Address:product.Shop_Address,  
                    Stock_Count:product.Stock_Count,   
                    Phone:product.Phone,     
                    Email:product.Email,
                    Whatsapp:product.Whatsapp,                 
                    Carted:product.Carted,
                    Updations:product.Updations,
                    UpdatedDate: Date,
                    UpdatedTime: Time  
                }
            })

            db.get().collection(collection.USER_PRODUCTS_COLLECTION).updateOne({_id:objectId(proId)},{
                $set:{
                    
                        
                    Name: product.Name,
                    Category: product.Category,
                    Actual_Price: product.Actual_Price,
                    Product_Owner:product.Product_Owner,
                    Offer_Price: product.Offer_Price,
                    Offer_Percentage: product.Offer_Percentage,
                    Description: product.Description,                              
                    Shop_Address:product.Shop_Address,  
                    Stock_Count:product.Stock_Count,   
                    Phone:product.Phone,     
                    Email:product.Email,
                    Whatsapp:product.Whatsapp,                 
                    Carted:product.Carted,
                    Updations:product.Updations,
                    UpdatedDate: Date,
                    UpdatedTime: Time               
                }
            })
        }
        })
    },
    searchProducts: (query) => {
        return new Promise(async (resolve, reject) => {
            try {
                const filter = {
                    $or: [
                        { Name: { $regex: query, $options: 'i' } },
                        { Description: { $regex: query, $options: 'i' } },
                        { Offer_Price: { $regex: query, $options: 'i' } },
                        { Category: { $regex: query, $options: 'i' } },
                        { Actual_Price: { $regex: query, $options: 'i' } },
                        { 
                            $expr: {
                                $regexMatch: {
                                    input: {
                                        $concat: [
                                            '$Name', ' ',
                                            '$Description', ' ',
                                            '$Offer_Price', ' ',
                                            '$Category', ' ',
                                            '$Actual_Price', ' ',
                                            {
                                                $cond: {
                                                    if: { $eq: ['$Product_Owner', 'Admin'] },
                                                    then: ' easy assurance',
                                                    else: ''
                                                }
                                            }
                                        ]
                                    },
                                    regex: query,
                                    options: 'i'
                                }
                            }
                        }
                    ]
                };
    
                const products = await db.get().collection(collection.PRODUCT_COLLECTION).find(filter).toArray();
                resolve(products);
            } catch (error) {
                reject(error);
            }
        });
    },
    
    addUserProduct: (product) => {
        return new Promise((resolve, reject) => {
            let Date = moment().format('DD MMM YYYY');
            let Time = moment().format('hh:mmA');

            let productDetails = {
                Name: product.Name,
                Category: product.Category,
                Product_Owner: product.Product_Owner,
                Actual_Price: product.Actual_Price,
                Offer_Price: product.Offer_Price,
                Offer_Percentage: product.Offer_Percentage,
                Description: product.Description,
                Seller_Id: objectId(product.User_Id),
                Seller_First_Name: product.User_First_Name,
                Seller_Last_Name: product.User_Last_Name,
                Phone:product.Phone,     
                Email:product.Email,
                Whatsapp:product.Whatsapp,       
                Shop_Address:product.Shop_Address,
                Stock_Count:product.Stock_Count,
                Status: product.Status,
                Carted:product.Carted,
                Updations:product.Updations,
                Date: Date,
                Time: Time
            };
          
            db.get().collection(collection.USER_PRODUCTS_COLLECTION).insertOne(productDetails).then((data) => {
                resolve(data.insertedId);
                console.log(data.insertedId);
            });
        });
    },
   
/**
 * Get product details including images stored in the public folder
 * @param {String} productId - The ID of the product
 * @returns {Object} - The product details including image file names
 */

    getProductImages:(productId)=> {
    return new Promise(async (resolve, reject) => {
    try {
      const productCollection = db.get().collection(collection.PRODUCT_COLLECTION); // Replace with your collection name
      const product = await productCollection.findOne({ _id: objectId(productId) });
  
      if (!product) {
        throw new Error('Product not found');
      }
  
      // Fetch images from the public/product-images folder
      const imageDir = path.join(__dirname, '../public/product-images');
      const imageFiles = fs.readdirSync(imageDir);
  
      // Filter images that belong to this product
      const productImages = imageFiles.filter(file => file.startsWith(productId));
      product.images = productImages;
      resolve(product);
    } catch (error) {
      console.error('Error fetching product details:', error);
      throw error;
    } })
  },
  
  getPndgProductImages:(productId)=> {
    return new Promise(async (resolve, reject) => {
    try {
      const productCollection = db.get().collection(collection.USER_PRODUCTS_COLLECTION); // Replace with your collection name
      const product = await productCollection.findOne({ _id: objectId(productId) });
  
      if (!product) {
        throw new Error('Pending Product not found');
      }
  
      // Fetch images from the public/product-images folder
      const imageDir = path.join(__dirname, '../public/product-images');
      const imageFiles = fs.readdirSync(imageDir);
  
      // Filter images that belong to this product
      const productImages = imageFiles.filter(file => file.startsWith(productId));
      product.images = productImages;
      resolve(product);
    } catch (error) {
      console.error('Error fetching pending product details:', error);
      throw error;
    } })
  },

  updateProductImages: (productId, updatedImages) => {
    return new Promise((resolve, reject) => {
        db.get().collection(collection.PRODUCT_COLLECTION).updateOne(
            { _id: objectId(productId) },
            {
                $set: {
                    images: updatedImages
                }
            }
        ).then((response) => {
            resolve(response);
        }).catch((err) => {
            reject(err);
        });
    });
},
updatePndgProductImages: (productId, updatedImages) => {
    return new Promise((resolve, reject) => {
        db.get().collection(collection.USER_PRODUCTS_COLLECTION).updateOne(
            { _id: objectId(productId) },
            {
                $set: {
                    images: updatedImages
                }
            }
        ).then((response) => {
            resolve(response);
        }).catch((err) => {
            reject(err);
        });
    });
},

}