const $fs = require("fs");
const $path = require("path");
const File = require("vinyl");
const through2 = require("through2");
const gutil = require("gulp-util");
const SourceMap = require("source-map");
const applySourceMap = require("vinyl-sourcemaps-apply");

const PluginError = gutil.PluginError;
const SourceNode = SourceMap.SourceNode;

//#region Utils
function isValued(v) { return v !== undefined && v !== null; }
function isString(v) { return (typeof v === "string"); }
function isRegExp(v) { return (v instanceof RegExp); }
function isBuffer(v) { return (v instanceof Buffer); }
function extend(...obj) { return Object.assign({}, ...obj); }
function getBoolean(v, defValue = false) { return !!(isValued(v) ? v : defValue); }
function escapeRegex(v) {
    if (!isValued(v)) return "";
    if (isRegExp(v)) return v.source;
    const escapes = /[.*+?^${}()|[\]\\]/g;
    return `${v}`.replace(escapes, "\\$&");
};
function toString(v) {
    if (!isValued(v)) return "";
    return `${v}`;
}
function toRegExp(v, forceNew = true) {
    if (isRegExp(v)) return forceNew ? new RegExp(v.source, v.flags) : v;
    if (!isValued(v)) return null;
    v = escapeRegex(toString(v));
    return new RegExp(`(${v})`);
}
function resolvePath(base, relative) {
    const baseDir = base || process.cwd();
    return $path.resolve(baseDir, relative);
}
function relativePath(path, cwd) {
    const cdwDir = cwd || process.cwd();
    return $path.relative(cdwDir, path);
}
function readFile(path, options) {
    try {
        options = extend({ cwd: process.cwd() }, options);
        if (path.startsWith(".") && options.pwd) {
            path = resolvePath(options.pwd, path);
        } else {
            path = resolvePath(options.cwd, path);
        }
        return new File({
            cwd: options.cwd,
            path: path,
            stat: $fs.statSync(path),
            contents: $fs.readFileSync(path)
        });
    } catch (err) {
        return null;
    }
}
function bufferToString(contents = "", encoding = "utf8") {
    if (!contents) return "";
    if (isString(contents)) return contents;
    if (isBuffer(contents)) return contents.toString(encoding);
    return `${contents}`;
}
function stringToBuffer(contents = "", encoding = "utf8") {
    if (!contents) return Buffer.from("", encoding); // null contents
    if (isBuffer(contents)) return contents; // contents is a Buffer already
    if (isString(contents)) return Buffer.from(contents, encoding); // turn string into Buffer
    if ("contents" in contents) return stringToBuffer(contents.contents, encoding); // contents probably is a Vinyl file
    return Buffer.from(`${contents}`, encoding); // cast contents into String and get a Buffer from there
}
function execRegExp(re, content = "", offset = 0) {
    if (!re || !content) return null;
    re = toRegExp(re);
    let str = content;
    if (offset > 0) {
        str = str.substring(offset);
    }
    const ret = re.exec(str);
    if (ret && offset > 0) {
        ret.index = ret.index + offset;
        ret.input = content;
        ret.offset = offset;
    }
    return ret;
}
function getLines(sourcecode) {
    let lines = sourcecode.split(/\r?\n/);
    try {
        // ignore trailing newlines
        while (lines.length > 1 && lines[lines.length - 1].trim() === "") {
            lines = lines.slice(0, lines.length - 1);
        }
    } catch (err) {
        throw err;
    }
    return lines;
}
function replaceAll(str, search, replacement = "") {
    if (!str || !search) return str;
    let re = search;
    if (!isRegExp(re)) {
        re = new RegExp(escapeRegex(`${re}`), "g");
    } else if (re.flags.indexOf("g") < 0) {
        re = new RegExp(re.source, `g${re.flags}`);
    }
    str = str.replace(re, replacement);
    return str;
}
//#endregion

class FileInjector {
    constructor(options = {}) {
        this.options = extend(
            {
                cwd: process.cwd(),
                delimiters: [
                    { type: "file", start: /\$file\(/, end: /\)/ },          // $file(...)
                    { type: "file", start: /\/\*!\s*\$file\(/, end: /\)\s*(\*\/)/ }, // /*! $file(...) */
                    { type: "prop", start: /\$prop\(/, end: /\)/ },          // $file(...)
                    { type: "prop", start: /\/\*!\s*\$prop\(/, end: /\)\s*(\*\/)/ }, // /*! $file(...) */
                ]
            },
            options);
        this.matcher = new ExpressionMatcher(this.options.delimiters);
    }
    get cwd() { return this.options.cwd; }
    get delimiters() { return this.options.delimiters; }

    get pluginName() { return "gulp-file-inject"; }
    transform(file, encoding, callback) {
        let result = null;
        try {
            if (!file.isNull()) {
                if (!file.isBuffer()) {
                    console.log("callback 1");
                    result = new PluginError(this.pluginName, "Only Buffer supported");
                } else {
                    const root = new SourceNode();
                    this.__unfold(file, encoding, root);
                    root.add(`\n`);
                    const result = root.toStringWithSourceMap({ file: file.path });
                    result.map = result.map.toJSON();
                    file.contents = stringToBuffer(result.code, encoding);
                    if (file.sourceMap && result.map) {
                        applySourceMap(file, result.map);
                    }
                }
            }
        } catch (err) {
            result = new PluginError(this.pluginName, err.message);
        }
        callback(result, file);
    }
    __unfold(file, encoding, srcNode, parsed) {
        const options = this.options;
        const matcher = this.matcher;
        if (typeof file === "string") {
            file = readFile(file);
        }
        if (!file) return srcNode;
        const relative = relativePath(file.path, options.cwd);
        let sourcecode = bufferToString(file.contents, encoding);
        srcNode.setSourceContent(relative, sourcecode);

        if (parsed && ("transform" in parsed)) {
            const transformName = parsed.transform;
            if (transformName in options.transforms) {
                const tmp = options.transforms[transformName](sourcecode);
                if (tmp) { sourcecode = tmp; }
            }
        }
        const lines = getLines(sourcecode);
        lines.forEach((line, i) => {
            const linIdx = i + 1; // SourceNode uses 1 based line indexes
            let colIdx = 0;
            while (colIdx < line.length) {
                let found = matcher.getNext(line, colIdx);
                let j = found ? found.startIndex : line.length;
                if (colIdx < j) {
                    let str = line.substring(colIdx, j);
                    srcNode.add(new SourceNode(linIdx, colIdx, relative, str));
                }
                if (found) {
                    const subParsed = found.content.parsed;
                    const subfile = readFile(subParsed.path, {pwd: $path.dirname($path.resolve(file.path))});
                    if (subfile) {
                        this.__unfold(subfile, encoding, srcNode, subParsed);
                    } else {
                        const ifAbsent = subParsed.ifAbsent || "fail";
                        switch (ifAbsent) {
                            case "fail":
                                throw new Error(`File "${subParsed.path}" not found (injection point: file: ${file.path}:${linIdx}:${colIdx})`);
                            case "keep":
                                srcNode.add(new SourceNode(linIdx, j, file.path, line.substring(j, found.endIndex)));
                                break;
                            case "empty":
                                // dont add to the src
                                break;
                        }
                    }
                    j = found.endIndex;
                }
                colIdx = j;
            }
            if (i < (lines.length - 1))
                srcNode.add("\n");
        });
        return srcNode;
    }
}

class ExpressionMatcher {
    constructor(delimiters) {
        this.delimiters = delimiters;
    }
    getNext(contents = "", offset = 0) {
        if (!contents || offset < 0 || offset >= contents.length) return null;
        if (offset > 0) { contents = contents.substring(offset); }
        let found = [];
        this.delimiters.forEach(d => {
            const startFound = execRegExp(d.start, contents);
            if (startFound) {
                const iStr = startFound[0];
                const i0 = startFound.index;
                const i1 = i0 + iStr.length;
                const endFound = execRegExp(d.end, contents, i1);
                if (endFound) {
                    const jStr = endFound[0];
                    const j0 = endFound.index;
                    const j1 = j0 + jStr.length;
                    const expr = contents.substring(i0, j1);
                    const content = contents.substring(i1, j0);
                    const match = {
                        startIndex: i0 + offset, // int : the index at wich the original expression starts
                        endIndex: j1 + offset, // int : the index at wich the original expression ends
                        rawString: expr, // string : the full original expression found, including delimiters
                        start: {
                            startIndex: i0 + offset, // int : the index at wich the delimiter.start starts
                            endIndex: i1 + offset, // int : the index at wich the delimiter.start ends
                            rawString: iStr, // string : the matched delimiter.start
                        },
                        content: {
                            startIndex: i1 + offset, // int : the index at wich the inner-content starts
                            endIndex: j0 + offset, // int : the index at wich the inner-content ends
                            parsed: this.__parseMatchContent(content),
                            rawString: content, // string : the expression inner-content found, excluding delimiters
                        },
                        end: {
                            startIndex: j0 + offset, // int : the index at wich the delimiter.end starts
                            endIndex: j0 + offset, // int : the index at wich the delimiter.end ends
                            rawString: jStr, // string : the matched delimiter.end
                        },
                        delimiter: d, // the delimiter definition used on the search
                    };
                    found.push(match);
                }
            }
        });
        found = found.sort((a, b) => a.startIndex - b.startIndex);
        if (found.length) {
            return found[0];
        }
        return null;
    }
    __parseMatchContent(content = "", schema = {
        ifAbsent: { type: "string", values: ["fail", "empty", "keep"] },
        transform: { type: "string" }
    }) {
        const sep = ",";
        const escSep = `\\${sep}`;
        const escSepPlaceholder = "<<ESCAPED_SEP>>";
        const sepRegex = new RegExp(`\\s*${escapeRegex(sep)}\\s*`);

        const split = replaceAll(content, escSep, escSepPlaceholder)
            .split(sepRegex)
            .map(v => replaceAll(v, escSepPlaceholder, sep).trim())
            .filter(v => !!v);
        const unwrap = (k) => {
            k = k.trim();
            if (k) {
                if (k.indexOf("\"") === 0 || k.indexOf("'") === 0) {
                    k = k.substring(1, k.length - 1);
                }
            }
            return `${k}`;
        }
        const parsed = {};
        split.forEach((prop, i) => {
            let key, val;
            const j = prop.indexOf("=");
            if (j > 0) {
                key = unwrap(prop.substring(0, j));
                val = unwrap(prop.substring(j + 1));
            } else if (i === 0) {
                key = "path";
                val = unwrap(prop);
            } else {
                key = unwrap(prop);
                val = "";
            }
            if (key in schema) {
                // convert val
                const type = schema[key].type;
                switch (type) {
                    case "boolean":
                        val = getBoolean(val, true);
                        break;
                    case "number":
                        val = val ? Number(val) : NaN;
                        break;
                }
                if (schema[key].values && schema[key].values.indexOf(val) < 0) {
                    val = schema[key].values[0];
                }
            }
            parsed[key] = val;
        });
        return parsed;
    }
}

module.exports = (options) => through2.obj(
    (file, enc, callback) => (new FileInjector(options)).transform(file, enc, callback)
);
