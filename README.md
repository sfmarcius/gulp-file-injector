<p align="center">
  <a href="http://gulpjs.com">
    <img height="257" width="114" src="https://raw.githubusercontent.com/gulpjs/artwork/master/gulp-2x.png">
  </a>
</p>

# gulp-file-injector

Gulp plugin that injects file contents into another files (much like an include directive).

> **NOTE:** This plugin still as `Work in Progress`!!!

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

exports.default = gulp.series(clean, build);
```

Assuming you have this on your `package.json`:
```javascript
{
    ...
    "scripts": {
        "build": "gulp",
        ...
    },
    ...
}
```

Just run: `npm run-script build`.

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
## Controlling file absence

Every time the plugin identifies a injection-point, it tries to do the injection.

By default, if said file doesn't exists, the plugin fails (throws exception).

You can change this behavior by signaling what to do in case of file not found.

Just right to the path, use a comma and the directive: `ifAbsent=[fail|keep|empty]`.

#### **`src/bundle.js`**
```javascript
//! $file(src/file1.js, ifAbsent=keep)
//! $file(src/file2.js, ifAbsent=empty)
if (func1) {
    console.log(func1());
}
if (func2) {
    console.log(func2());
}
```

* **fail**: is the default behavior.
* **keep**: if the file is not found, the expression is kept as is on the output.
* **empty**: if the file is not found, assume an empty file, thus removing the expression on the output.

## Options

The default patterns recognized are:

* `$file(path/to/file.ext)`
* `//! $file(path/to/file.ext)`
* `/*! $file(path/to/file.ext) */`
* `<!--! $file(path/to/file.ext) -->;`
* `<file path="path/to/file.ext" />;`
* `//! <file path="path/to/file.ext" />;`
* `/*! <file path="path/to/file.ext" />; */`
* `<!--! <file path="path/to/file.ext" />; -->;`


### Replacing default patterns

If you need or want to replace the default patterns with your own, just pass a plain
object to the plugin, containing the array of *`delimiters`* you need.

Each delimiter must have a *`start`* regex and an *`end`* regex. Anything between these
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
object to the plugin, containing the array of *`extraDelimiters`* you need.
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

> **NOTE: ** Keep in mind that the injection-point expression must be on a single line of code!

#### **`this_works.js`**
```javascript
/*! $file( src/file1.js ) */
console.log("this file injection works!");
```

#### **`this_works_too.js`**
```javascript
// inline injection
function myObject() {
    return /*! $file( src/myObject.json ) */;
}
console.log("this file injection works!");
```

#### **`this_doesnt_work.js`**
```javascript
/*! $file(
    src/file1.js
) */
console.log("this file injection doesn't work!");
```


## TODO

As noted previowsly, this is a WIP.

The project's testing is lacking at the moment and it can contain some edge-cases bugs.

Also, I aim to integrate my other plugin *gulp-replacer* into this one, so it will be possible to inject
properties and files with the same plugin, but for now I will leave this integration for another ocasion.
