import * as http from "http";
import * as https from 'https';
export type PrimitiveType = string | boolean | number | bigint;
export type PromiseAble = Promise<void> | void;

export interface PlainObject {
    [key: string]: PrimitiveType;
}


export interface InitHandler {
    (app: App, globalData?: GlobalData): PromiseAble;
}

export interface Context {
    res: http.ServerResponse,
    req: http.IncomingMessage,
    shareData: Object,
    params(key?: String, dvalue?: any): any;
    paramsSet(key: String, value: any): void;
    success(data: any): void;
    error(msg?: string, code?: Number, data?: any): void;
    html(html: String): void;
    content(content: String): void;
}
export interface ContextHandler {
    (ctx: Context, globalData: GlobalData): any;
}

export interface GlobalData {
    $service: Object | Function;
    [key: string]: any
}

export type Controller = Record<string, ContextHandler>;


export declare class App {
    constructor();
    globalData: GlobalData;
    module(name: String, module: String|Controller|Record<string,Controller>): App;
    init(hook: InitHandler): App;
    use(handler: ContextHandler): App;
    service(name: String, service: Object): App;
    servicePath(path: String): App;
    route(path: String, handler: ContextHandler): App;
    listen(port: Number, httpsOptions?: https.ServerOptions): Promise<http.Server>;
    callback(): Promise<http.RequestListener>
    static createServer(): App;
    static defineController(controller: Controller): Controller;
}

export function defineController(controller: Controller): Controller;


export default App;