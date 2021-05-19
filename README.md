# gulp-file-injector

Gulp plugin that injects file contents into another files (much like an include directive).

<mark>NOTE: This plugin is Work in Progress!!!</mark>

# Usage

First, install the plugin as a dev dependency:
```
    npm install gulp-file-injector -D
```

Say you have these files:
```javascript
// src/file1.js
function func1() {
    return "hello 1";
}
```

```javascript
// src/file2.js
function func2() {
    return "hello 2";
}
```

```javascript
// src/bundle.js
$file(src/file1.js)
$file(src/file2.js)

console.log(func1());
console.log(func2());
```
Then you can start using it, as follows:
```javascript
    const inject = require("gulp-file-injector");

    gulp.task('replace', function () {
        gulp.src(['src/**/*.js'])
            .pipe(inject())
            .pipe(gulp.dest('build/'));
    });
```

This example will inject the contents of *"file1.js"* and *"file2.js"* into *"bundle.js"*.

# options (`Plain object`)

You can give custom patterns to the injector, like:
```javascript

    gulp.task('replace', function () {
        gulp.src(['src/**/*.js'])
            .pipe(inject(
                {
                    delimiters: [
                        { start: /\#file\{/, end: /\}/ },
                    ]
                }
            ))
            .pipe(gulp.dest('build/'));
    });
```

Thus injecting the files by identifying the "#file{path/to/file}" pattern
in this example.

## options.delimiters
Array of delimiters.

Each delimiter is a plain object containing a *start* regex and an *end* regex. 
