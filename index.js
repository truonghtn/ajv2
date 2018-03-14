"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ajv = require("ajv");
const utils_nodejs_1 = require("utils-nodejs");
const ALL_TOKENS = ['++'];
;
function craft(schema) {
    return craftObjSchema(schema);
}
exports.craft = craft;
function pullV2Name(name) {
    if (utils_nodejs_1.default.indexOf(ALL_TOKENS, name) >= 0) {
        return {
            isV2: false,
            name: name,
            isRequired: false,
            token: name
        };
    }
    if (name.startsWith('@')) {
        return {
            isV2: true,
            name: name.substr(1, name.length - 1),
            isRequired: false
        };
    }
    else if (name.startsWith('+@')) {
        return {
            isV2: true,
            name: name.substr(2, name.length - 2),
            isRequired: true
        };
    }
    else if (name.startsWith('+')) {
        return {
            isV2: false,
            name: name.substr(1, name.length - 1),
            isRequired: true
        };
    }
    return {
        isV2: false,
        name: name,
        isRequired: false
    };
}
function craftKeyValSchema(desc, schema) {
    if (desc.isV2) {
        if (utils_nodejs_1.default.isObject(schema)) {
            return craftObjSchema(schema);
        }
        else if (utils_nodejs_1.default.isString(schema)) {
            return craftStringSchema(schema);
        }
    }
    else {
        if (utils_nodejs_1.default.isArray(schema)) {
            return schema;
        }
        else if (utils_nodejs_1.default.isObject(schema)) {
            return craftRawMapSchema(schema);
        }
    }
    return schema;
}
function craftStringSchema(schema) {
    const res = schema.split('|');
    if (res.length == 1) {
        return {
            type: schema
        };
    }
    const type = res[0];
    const retSch = {
        type: type
    };
    if (type == 'string') {
        for (let i = 1; i < res.length; ++i) {
            const desc = res[i];
            const minLenRegEx = /^len([\<\>])=([\d]+)$/;
            if (minLenRegEx.test(desc)) {
                const matches = desc.match(minLenRegEx);
                const cmp = matches[1];
                const val = parseInt(matches[2]);
                const keyword = cmp == '>' ? 'minLength' : 'maxLength';
                retSch[keyword] = val;
                continue;
            }
            const patternRegEx = /^p=(.*)$/;
            if (patternRegEx.test(desc)) {
                const matches = desc.match(patternRegEx);
                const pattern = matches[1];
                retSch.pattern = pattern;
                continue;
            }
        }
    }
    else if (type == 'number' || type == 'integer') {
        for (let i = 1; i < res.length; ++i) {
            const desc = res[i];
            const limitRegEx = /^([\<\>])(=?)(-?[\d\.]+)$/;
            if (limitRegEx.test(desc)) {
                const matches = desc.match(limitRegEx);
                const cmp = matches[1];
                const eq = matches[2] == '=';
                const val = utils_nodejs_1.default.isInteger(matches[3]) ? parseInt(matches[3]) : parseFloat(matches[3]);
                let keyword = null;
                if (cmp == '>') {
                    retSch.minimum = val;
                    if (!eq) {
                        retSch.exclusiveMinimum = true;
                    }
                }
                else if (cmp == '<') {
                    retSch.maximum = val;
                    if (!eq) {
                        retSch.exclusiveMaximum = true;
                    }
                }
                if (keyword) {
                    retSch[keyword] = val;
                }
                continue;
            }
            const multipleOfRegEx = /^\%(-?[\d\.]+)$/;
            if (multipleOfRegEx.test(desc)) {
                const matches = desc.match(multipleOfRegEx);
                const val = utils_nodejs_1.default.isInteger(matches[1]) ? parseInt(matches[1]) : parseFloat(matches[1]);
                retSch.multipleOf = val;
                continue;
            }
        }
    }
    return retSch;
}
function craftObjSchema(schema) {
    const props = {};
    let required = [];
    let additionalProperties = undefined;
    for (const key in schema) {
        const desc = pullV2Name(key);
        const subSch = schema[key];
        if (desc.token == '++') {
            additionalProperties = subSch;
            continue;
        }
        props[desc.name] = craftKeyValSchema(desc, subSch);
        if (desc.isRequired) {
            required.push(desc.name);
        }
    }
    if (utils_nodejs_1.default.isEmpty(required)) {
        required = undefined;
    }
    return {
        type: 'object',
        properties: props,
        required: required,
        additionalProperties: additionalProperties
    };
}
function craftRawMapSchema(schema) {
    const ret = {};
    for (const key in schema) {
        const subSch = schema[key];
        const desc = pullV2Name(key);
        ret[desc.name] = craftKeyValSchema(desc, subSch);
    }
    return ret;
}
function ajv2() {
    const _ajv = ajv();
    return (sch, log = false) => {
        const ajvSch = craft(sch);
        if (log) {
            console.log(JSON.stringify(ajvSch));
        }
        ;
        return _ajv.compile(ajvSch);
    };
}
exports.ajv2 = ajv2;
exports.default = ajv2;
//# sourceMappingURL=index.js.map