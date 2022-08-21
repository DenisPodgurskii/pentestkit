import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const fs = require('fs')
let archiver = require('archiver')

//package
if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
}

let manifestChrome = JSON.parse(fs.readFileSync('./src/manifest.json', 'utf8'))
let manifestFirefox = JSON.parse(fs.readFileSync('./src/manifest2.json', 'utf8'))
fs.unlinkSync('src/manifest2.json')

// Chrome
let output = fs.createWriteStream('./dist/chrome_' + manifestChrome.version + '.zip')
let archive = archiver('zip')
output.on('close', function () {
    console.log(archive.pointer() + ' total bytes')
    console.log('archiver has been finalized and the output file descriptor has closed.')
})
archive.on('error', function (err) {
    throw err
})

archive.pipe(output)
archive.directory('./src/', false)
archive.finalize()

await new Promise(resolve => {
    setTimeout(resolve, 3000)
})


// Firefox
fs.writeFileSync('./src/manifest.json', JSON.stringify(manifestFirefox, null, 4))
output = fs.createWriteStream('./dist/firefox_' + manifestFirefox.version + '.zip')
archive = archiver('zip')
output.on('close', function () {
    console.log(archive.pointer() + ' total bytes')
    console.log('archiver has been finalized and the output file descriptor has closed.')
})
archive.on('error', function (err) {
    throw err
})
archive.pipe(output)
archive.directory('./src/', false)
archive.finalize()

await new Promise(resolve => {
    setTimeout(resolve, 3000)
})

fs.writeFileSync('./src/manifest.json', JSON.stringify(manifestChrome, null, 4))
fs.writeFileSync('./src/manifest2.json', JSON.stringify(manifestFirefox, null, 4))

