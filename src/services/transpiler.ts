import { Transpiler } from './types';
import { transpileToLua } from '../executor';

export type TranspilePass = (code: string) => string;

class DefaultTranspiler implements Transpiler {
    private prePasses: TranspilePass[] = [];
    private postPasses: TranspilePass[] = [];

    transpile(code: string): string {
        let psc = code;
        for (const pass of this.prePasses) psc = pass(psc);
        let lua = transpileToLua(psc);
        for (const pass of this.postPasses) lua = pass(lua);
        return lua;
    }

    registerPrePass(pass: TranspilePass) {
        this.prePasses.push(pass);
    }

    registerPostPass(pass: TranspilePass) {
        this.postPasses.push(pass);
    }
}

export const transpiler = new DefaultTranspiler();
