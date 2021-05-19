# gulp-file-injector

Gulp plugin that injects file contents into another files (much like an include directive).

> **NOTE:** This plugin is Work in Progress!!!

# Usage

First, install the plugin as a dev dependency:
```console
npm install gulp-file-injector -D
```

Say you have these files:
#### **`src/file1.js`**
```javascript
function func1() {
    return "hello 1";
}
```

#### **`src/file2.js`**
```javascript
function func2() {
    return "hello 2";
}
```

#### **`src/bundle.js`**
```javascript
//! $file(src/file1.js)
//! $file(src/file2.js)
console.log(func1());
console.log(func2());
```

Then you can start using it, as follows:

#### **`gulpfile.js`**
```javascript
const gulp = require("gulp");
const del = require("del");
const sourcemaps = require("gulp-sourcemaps");
const injectFiles = require("gulp-file-injector");

const clean = () => {
    return del([`${outputDir}/**`]);
};
const build = () => {
    return gulp
        .src([`src/**/*.js`])
        .pipe(sourcemaps.init())
        .pipe(injectFiles())
        // do other stuff...
        .pipe(sourcemaps.write("."))
        .pipe(gulp.dest(`dist`));
};

exports.default = build;
```

This example will inject the contents of *"file1.js"* and *"file2.js"* into *"bundle.js"*:
#### **`dest/bundle.js`**
```javascript
function func1() {
    return "hello 1";
}
function func2() {
    return "hello 2";
}
console.log(func1());
console.log(func2());
```
## Options

### Replacing default patterns

If you need or want to replace the default patterns with your own, just pass a plain
object to the plugin, containing the array of *delimiters* you need.

Each delimiter must have a *start* regex and a *end* regex. Anything between these
delimiters will be treated as the file path being included.

```javascript
    ...
    .pipe(injectFiles(
        {
            delimiters: [
                // will replace default patterns with these:
                // #file{ path/to/file }
                { start: /\#file\{\s*/i, end: /\s*\}/i }
            ]
        }
    ))
    ...
```

### Adding extra patterns

If you want to keep the default patterns and just add new ones, just pass a plain
object to the plugin, containing the array of *extraDelimiters* you need.
```javascript
    ...
    .pipe(injectFiles(
        {
            extraDelimiters: [
                // will keep the default patterns and add these extra ones:
                // #file{ path/to/file }
                { start: /\#file\{\s*/i, end: /\s*\}/i }
            ]
        }
    ))
    ...
```

## TODO

As noted previowsly, this is a WIP.

The project's testing is lacking at the moment and it can contain some edge-cases bugs.

Also, I aim to integrate my other plugin *gulp-replacer* into this one, so it will be possible to inject
properties and files with the same plugin, but for now I will leave this integration for another ocasion.
