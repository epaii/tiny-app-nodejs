const  reg = new RegExp("/epii-app/(.*?)/(\\d+)$", "i");
console.log(reg.exec("/epii-app/adsfas/43").length)

const  reg1 = new RegExp("^/epii-app", "i");
console.log(reg1.exec("/epii-app").length)