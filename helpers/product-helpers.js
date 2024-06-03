var db=require('../config/connection')
var collection=require('../config/collections')
const { response } = require('express')
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
    getAllProducts:()=>{
        return new Promise(async(resolve,reject)=>{
            
            let products=await db.get().collection(collection.PRODUCT_COLLECTION).find().toArray()
            resolve(products)
        })
    },
    deleteProduct:(prodId)=>{
        return new Promise((resolve,reject)=>{
            console.log(prodId);
            console.log(objectId(prodId));
            db.get().collection(collection.PRODUCT_COLLECTION).removeOne({_id:objectId(prodId)}).then((response)=>{
               //console.log(response);
                resolve(response)
            })
        })
    },
    getProductDetails:(proId)=>{
        return new Promise((resolve,reject)=>{
            db.get().collection(collection.PRODUCT_COLLECTION).findOne({_id:objectId(proId)}).then((product)=>{
                resolve(product)
            })
        })
    },
    updateProduct:(proId,proDetails)=>{
        return new Promise((resolve,reject)=>{
            db.get().collection(collection.PRODUCT_COLLECTION).updateOne({_id:objectId(proId)},{
                $set:{
                    Name:proDetails.Name,
                    Description:proDetails.Description,
                    Price:proDetails.Price,
                    Category:proDetails.Category
                }
            }).then((response)=>{
                resolve()
            })
        })
    },
    searchProducts: (query) => {
        return new Promise(async (resolve, reject) => {
            try {
                let filter = {
                    $or: [
                        { Name: { $regex: query, $options: 'i' } },
                        { Description: { $regex: query, $options: 'i' } },
                        { Price: { $regex: query, $options: 'i' } },
                        { Category: { $regex: query, $options: 'i' } }
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
            db.get().collection(collection.PENDING_COLLECTION).insertOne(product).then((data) => {
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
  }
    

}