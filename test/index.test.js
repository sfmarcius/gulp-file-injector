const chai = require("chai");
const chaiExclude = require("chai-exclude");
chai.use(chaiExclude);
const expect = chai.expect;
const fs = require("fs-extra");
const File = require("vinyl");
const plugin = require("../src/index");

function doTest(targetFunction, targetArgs, testFilename, doneCallback) {
    let inputFile = new File({ path: `test/fixtures/${testFilename}`, contents: fs.readFileSync(`test/fixtures/${testFilename}`) });
    let expectedContent = fs.readFileSync(`test/expected/${testFilename}`, "utf8");
    let check = function (stream, done, cb) {
        stream.on("data", function (newFile) {
            cb(newFile);
            done();
        });
        stream.write(inputFile);
        stream.end();
    };
    var stream = targetFunction.apply(null, targetArgs);
    check(stream, doneCallback, function (outputFile) {
        let actualContent = String(outputFile.contents);
        expect(actualContent).to.equal(expectedContent);
    });
}

describe("gulp-file-injector", () => {
    let filenames = [ "test_01.txt", "test_02.txt", "test_03.txt", "test_04.txt"];
    
    filenames.forEach(filename => {
        it(`inject fixtures/${filename}`, (doneCallback) => {
            doTest(plugin, {}, filename, doneCallback);
        });
    });
});
