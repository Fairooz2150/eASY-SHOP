var db=require('../config/connection')
var collection=require('../config/collections')
const bcrypt=require('bcrypt')
var objectId=require('mongodb').ObjectID

module.exports={
    doLogin:(adminData)=>{
        return new Promise(async(resolve,reject)=>{
            let loginStatus=false
            let response={}
            let admin=await db.get().collection(collection.ADMIN_COLLECTION).findOne({Email:adminData.Email})
            if(admin){
                 bcrypt.compare(adminData.Password,admin.Password).then((status)=>{
                    if(status){
                        console.log('Admin Loggedin Successfully')
                        response.admin=admin
                        response.status=true
                        resolve(response)
                    }else{
                        console.log('Wrong password entered')
                        resolve({status:false})
                    }
                 })
            }else{
                console.log('No admin in this email id')
                resolve({status:false})
            }
        })
    },
   
}