
 



// let a={
//     c:1
// }

// let b={
//     e:3,
//     hh(){
//         console.log(this.c);
//     }
// }
// b.__proto__  = a;
// console.log(b.hh());

const App=require("../src/index");
 
new  App().serviceDir(__dirname+"/service").init( async function(app){
    return new Promise(ok=>{
        setTimeout(() => {
            ok();
        }, 3000);
    })
}).use(function(ctx){
    console.log("a")
    console.log(this.$service);
}).use(function(ctx){
    console.log("b")
    console.log(this.$service);
}).module(__dirname+"/app").listen(8896);