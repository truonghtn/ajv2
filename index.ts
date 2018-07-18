import * as ajv from 'ajv';
import _ from 'utils-nodejs'

type SPECIAL_TOKEN = '++';
const ALL_TOKENS = ['++'];

interface ajv2NameDesc {
    isV2: boolean;
    name: string;
    isRequired: boolean;
    token?: SPECIAL_TOKEN;
};

export function craft(schema: _.Dictionary<any>): any {
    return craftObjSchema(schema);
}

function pullV2Name(name: string): ajv2NameDesc {
    if (_.indexOf(ALL_TOKENS, name) >= 0) {
        return {
            isV2: false,
            name: name,
            isRequired: false,
            token: <SPECIAL_TOKEN> name
        };
    }

    if (name.startsWith('@')) {
        return <ajv2NameDesc> {
            isV2: true,
            name: name.substr(1, name.length - 1),
            isRequired: false
        };
    }
    else if (name.startsWith('+@')) {
        return <ajv2NameDesc> {
            isV2: true,
            name: name.substr(2, name.length - 2),
            isRequired: true
        };
    }
    else if (name.startsWith('+')) {
        return <ajv2NameDesc> {
            isV2: false,
            name: name.substr(1, name.length - 1),
            isRequired: true
        };
    }
    
    return <ajv2NameDesc> {
        isV2: false,
        name: name,
        isRequired: false
    };
}

function craftKeyValSchema(desc: ajv2NameDesc, schema: any): any {
    if (desc.isV2) {
        if (_.isObject(schema)) {
            return craftObjSchema(schema);
        }
        else if (_.isString(schema)) {
            return craftStringSchema(schema);
        }
    }
    else {
        if (_.isArray(schema)) {
            return schema;
        }
        else if (_.isObject(schema)) {
            return craftRawMapSchema(schema);
        }
    }

    return schema;
}

function craftStringSchema(schema: string): any {
    const res = schema.split('|');
    if (res.length == 1) {
        return {
            type: schema
        };
    }

    const type = res[0];
    const retSch: any = {
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
                const val = _.isInteger(matches[3]) ? parseInt(matches[3]) : parseFloat(matches[3]);

                let keyword = null;
                if (cmp == '>') {
                    if (eq) {
                        retSch.minimum = val;
                    }
                    else {
                        retSch.exclusiveMinimum = val;
                    }
                }
                else if (cmp == '<') {
                    if (eq) {
                        retSch.maximum = val;
                    }
                    else {
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
                const val = _.isInteger(matches[1]) ? parseInt(matches[1]) : parseFloat(matches[1]);

                retSch.multipleOf = val;
                continue;
            }
        }
    }

    return retSch;
}

function craftObjSchema(schema: _.Dictionary<any>): any {
    const props: any = {};
    let required: string[] = [];
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

    if (_.isEmpty(required)) {
        required = undefined;
    }

    return {
        type: 'object',
        properties: props,
        required: required,
        additionalProperties: additionalProperties
    };
}

function craftRawMapSchema(schema: _.Dictionary<any>): any {
    const ret: any = {};
    for (const key in schema) {
        const subSch = schema[key];
        const desc = pullV2Name(key);
        ret[desc.name] = craftKeyValSchema(desc, subSch);
    }

    return ret;
}

export function newAjv2() {
    const _ajv = ajv();
    return (sch: any, log: boolean = false) => {
        const ajvSch = craft(sch);
        if (log) {console.log(JSON.stringify(ajvSch))};
        return _ajv.compile(ajvSch);
    }
}

export default newAjv2;