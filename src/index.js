const url = require("url");
const queryString = require("querystring");
const fs = require("fs");
const path = require("path");

function walkSync(currentDirPath, bindToObject) {
    var fs = require('fs'),
        path = require('path');
    fs.readdirSync(currentDirPath).forEach(function (name) {
        var filePath = path.join(currentDirPath, name);
        var stat = fs.statSync(filePath);
        if (stat.isFile()) {
            bindToObject[path.basename(filePath, '.js')] = require(filePath);
        } else if (stat.isDirectory()) {
            let varname = filePath.split(path.sep).pop();
            // console.log(varname);
            bindToObject[varname] = {};
            walkSync(filePath, bindToObject[varname]);
        }
    });
}


class App {
    static createServer() {
        return new App();
    }
    static defineController(controller) { return controller; }
    constructor() {
        this.route_maps = {};
        this.module_s = {};
        this.globalData = {
            $service: {

            }
        }
        this.$runtime = {
            inits: [],
            middlewares: []
        }
    }
    responseJson(res, data) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(JSON.stringify(data));
    }

    apiSuccess(res, data = {}) {

        this.responseJson(res, {
            code: 1,
            msg: "成功",
            data: data
        })
    }
    apiError(res, msg, code = 0, data = {}) {
        this.responseJson(res, {
            code: code,
            msg: msg,
            data: data
        })
    }
    module(name, baseDirOrObject) {
        if (arguments.length == 1) {
            name = "epii-app";
            baseDirOrObject = arguments[0]
        }

        if (typeof baseDirOrObject === "object") {
            this.module_s["/" + name] = {
                apps: baseDirOrObject,
                name: "/" + name
            }
        } else if (typeof baseDirOrObject === "string") {

            if (!fs.existsSync(baseDirOrObject)) {
                console.log(baseDirOrObject + "is not exist");
                return this;
            }

            if (name.indexOf("/") === 0) {
                name = name.substr(1);
            }
            this.module_s["/" + name] = {
                dir: baseDirOrObject,
                apps: {

                },
                name: "/" + name
            }
        }

        return this;
    }
    init(callback) {
        this.$runtime.inits.push(callback);
        return this;
    }
    use(callback) {
        this.$runtime.middlewares.push(callback.bind(this.globalData));
        return this;
    }
    service(name, object) {
        if (!this.globalData.$service.hasOwnProperty(name)) {
            this.globalData.$service[name] = object;
        } else {
            Object.assign(this.globalData.service[name], object);
        }
        return this;
    }
    serviceDir(serviceDir) {
        if (fs.existsSync(serviceDir)) {
            walkSync(serviceDir, this.globalData.$service);
        }

        return this;
    }
    servicePath(path) {
        return this.serviceDir(path);
    }
    findHander(pathname) {
        for (let key in this.route_maps) {
            if (key === pathname) {
                return { handler: this.route_maps[key], gets: [] }
            }
        }
        for (let key in this.route_maps) {

            const reg = new RegExp("^" + key, "i");
            const reg_info = reg.exec(pathname);
            if (reg_info) {

                return { handler: this.route_maps[key], gets: Array.from(reg_info) }
            }
        }
        return null;
    }
    route(path, handler) {
        this.route_maps[path] = (typeof handler === "function") ? handler.bind(this.globalData) : handler;
        return this;
    }
    appHandler(moduleInfo) {
        return {
            handler: (params) => {
                let app_tmp = (params["app"] ? params["app"] : "index@index").split("@");
                if (app_tmp.length == 1) app_tmp[1] = "index";

                if (!moduleInfo.apps.hasOwnProperty(app_tmp[0])) {
                    let file = moduleInfo.dir + "/" + app_tmp[0] + ".js";
                    if (!fs.existsSync(file)) {
                        file = moduleInfo.dir + "/" + app_tmp[0] + ".ts";
                    }
                    if (fs.existsSync(file)) {
                        let m = require(file);
                        if (m.default) m = m.default;
                        if (typeof m === "function") {
                            moduleInfo.apps[app_tmp[0]] = m.bind(this.globalData);
                        } else if (typeof m === "object") {

                            m.__proto__ = this.globalData;

                            moduleInfo.apps[app_tmp[0]] = m;
                            if (moduleInfo.apps[app_tmp[0]].init) {
                                moduleInfo.apps[app_tmp[0]].init();
                            }
                        }


                    }
                }

                if (moduleInfo.apps[app_tmp[0]]) {
                    if (typeof moduleInfo.apps[app_tmp[0]] === "function") {
                        return function(){
                            return moduleInfo.apps[app_tmp[0]](...arguments);
                        }
                    }
                    if ((typeof moduleInfo.apps[app_tmp[0]] === "object") && moduleInfo.apps[app_tmp[0]].hasOwnProperty(app_tmp[1])) {
                        return moduleInfo.apps[app_tmp[0]][app_tmp[1]].bind(moduleInfo.apps[app_tmp[0]]);
                    }
                }

                return null;

            },
            name: moduleInfo.name
        }
    }
    async callback() {
        let that = this;
        let inits_l = this.$runtime.inits.length;
        for (let i = 0; i < inits_l; i++) {
            await (this.$runtime.inits[i].bind(this.globalData))(this, this.globalData);
        }

        for (let name in this.module_s) {
            this.route(name, this.appHandler(this.module_s[name]))
        }
        return (request, response) => {

            request.setEncoding('utf-8');
            let url_info = url.parse(request.url, true);

            let pathname = url_info.pathname;

            let handler = this.findHander(pathname);


            if (!handler) {
                this.apiError(response, "没有处理器");
            } else {


                var postData = "";
                // 数据块接收中
                request.on("data", (postDataChunk) => {
                    postData += postDataChunk;
                });

                request.on("end", async () => {

                    var params = {};
                    try {
                        //  console.log(request.headers);
                        if (request.headers["content-type"] && (request.headers["content-type"].indexOf("json") > 0)) {
                            params = JSON.parse(postData.toString());
                        } else {
                            let postString = postData.toString();
                            if (postString.length > 0) {
                                params = JSON.parse(JSON.stringify(queryString.parse(postData.toString())));

                            }
                        }
                    } catch (e) {
                        params = {};
                    }

                    Object.assign(params, url_info.query);

                    for (let i = 0; i < handler.gets.length; i++) {
                        params["$" + i] = handler.gets[i];
                    }
                    params["$$"] = pathname;

                    let handler_object = {

                        req: request,
                        res: response,
                        canNext: true,
                        shareData: {},
                        params(key, dvalue = null) {

                            if (arguments.length == 0) return params;
                            return params.hasOwnProperty(key) ? params[key] : dvalue;
                        },
                        paramsSet(key, value) {
                            params[key] = value;
                            return this;
                        },
                        success(data) {
                            that.apiSuccess(this.res, data);
                            this.canNext = false;
                        },
                        error(msg = "error", code = 0, data = {}) {
                            that.apiError(this.res, msg, code, data);
                            this.canNext = false;
                        },
                        html(htmlString) {
                            this.res.setHeader('Content-Type', 'text/html; charset=utf-8');
                            this.res.end(htmlString);
                            this.canNext = false;
                        },
                        content(content) {
                            this.html(content);
                        }

                    };

                    let m_len = this.$runtime.middlewares.length;
                    for (let i = 0; i < m_len; i++) {
                        await this.$runtime.middlewares[i](handler_object, this.globalData);
                        if (!handler_object.canNext) {
                            return;
                        }
                    }

                    handler = handler.handler;
                    if ((typeof handler === "object") && handler.handler) {
                        //判断是否有app
                        if (!params.app) {
                            let app_tmp_s = (pathname.endsWith("/")?pathname:`${pathname}/`).replace(handler.name + "/", "").split("/");
                            params.app = app_tmp_s[0] + (app_tmp_s.length > 1 ? ("@" + app_tmp_s[1]) : "");
                        }
                        handler = handler.handler(params);
                    }

                    if (!handler) {
                        that.apiError(response, "没有app处理器");
                        return;
                    }
                    try {
                        let out = await handler(handler_object, that.globalData)
                        if (out !== undefined) {
                            that.apiSuccess(response, out);
                        }
                    } catch (error) {

                        that.apiError(response, typeof error === "string" ? error : error.message);

                    }

                });

            }
        }

    }

    async listen(port, httpsOptions = null) {
        try {
            if (httpsOptions) {
                let server = require("https").createServer(httpsOptions, await this.callback());
                server.listen(port);
                console.log("server start at port:" + port)

                return server;
            } else {
                let server = require("http").createServer(await this.callback());
                server.listen(port);
                console.log("server start at port:" + port)

                return server;
            }
        } catch (error) {
            console.log(error);
        }

    }
}



module.exports = App;