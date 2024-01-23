/* Author: Denis Podgurskii */
import { ptk_controller_rbuilder } from "../../../controller/rbuilder.js"
import { ptk_utils, ptk_jwtHelper } from "../../../background/utils.js"
import { ptk_decoder } from "../../../background/decoder.js"
import * as rutils from "../js/rutils.js"
import parse from "../../../background/lib/curl.js"




const controller = new ptk_controller_rbuilder()

controller.waiting = false
const decoder = new ptk_decoder()
const jwtHelper = new ptk_jwtHelper()

jQuery(function () {


    $('.modal.coupled')
        .modal({
            allowMultiple: true
        })
    // let editor = CodeMirror.fromTextArea(document.getElementsByName('request')[0], {
    //     lineNumbers: false, lineWrapping: true, mode: "message/http",
    //     scrollbarStyle: null
    // })
    // editor.setSize('auto', '100%')



    $(document).on("init_request", function (e, request, formId) {
        if (request && request.requestHeaders) {

            let $form = $('#' + formId + ' #request_form')
            let path = request.method + ' ' + request.url + ' HTTP/1.1'
            let headersStr = path + '\n' + request.requestHeaders.map(x => x.name + ": " + x.value).join('\n')

            if (request?.requestBody?.formData) {
                let params = Object.keys(request.requestBody.formData).map(function (k) {
                    return encodeURIComponent(k) + '=' + encodeURIComponent(request.requestBody.formData[k])
                }).join('&')
                headersStr += "\n\n" + params
            } else if (request?.requestBody?.raw) {
                headersStr += "\n\n" + request.requestBody.raw
            }

            //$form.form('set values', { 'request': headersStr })
            $form.form('set values', {
                'request': headersStr,
                'follow_redirect': true,
                'update_content_length': true,
                'use_content_type': true
            })
            $(document).trigger("parse_request", formId)
        }
    })

    $(document).on("reset_form", function (e, formId) {
        let $form = $('#' + formId + ' #request_form')
        $form.form('clear')
        $form.form('set values', {
            'request': '', 'request_method': 'GET',
            'request_protocol': 'http',
            'override_headers': true,
            'follow_redirect': true,
            'update_content_length': true,
            'use_content_type': true
        })

        $form.form({
            inline: true,
            keyboardShortcuts: false,
            fields: {
                request_method: {
                    identifier: 'request_method',
                    rules: [{ type: 'empty' }]
                },
                request_protocol: {
                    identifier: 'request_protocol',
                    rules: [{ type: 'empty' }]
                },
                request_url: {
                    identifier: 'request_url',
                    rules: [{
                        prompt: 'URL is required',
                        type: 'regExp',
                        value: /^(?:([A-Za-z]+):)?(\/{0,3})([0-9.\-A-Za-z]+)(?::(\d+))?(?:\/([^?#]*))?(?:\?([^#]*))?(?:#(.*))?$/i,
                    }]
                }
            }
        })
    })


    $(document).on("parse_request", function (e, formId) {
        let $form = $('#' + formId + ' #request_form')
        let values = $form.form('get values')


        let opts = {
            override_headers: values['override_headers'] == 'on' ? true : false,
            follow_redirect: values['follow_redirect'] == 'on' ? true : false,
            update_content_length: values['update_content_length'] == 'on' ? true : false,
            use_content_type: values['use_content_type'] == 'on' ? true : false
        }
        try {
            if (values['request']) {
                let rawRequest = values['request']

                try {
                    let curlObj = parse(rawRequest.replace(/\\\r?\n/g, " "))
                    if (curlObj.url && curlObj.method) {
                        rawRequest = `${curlObj.method} ${curlObj.url} HTTP/1.1\r\n`
                        let hKeys = Object.keys(curlObj.headers)
                        for (var i = 0; i < hKeys.length; i++) {
                            rawRequest += `${hKeys[i]}: ${curlObj.headers[hKeys[i]]}\r\n`
                        }

                        if (curlObj.body) {
                            let body = curlObj.body
                            try {
                                body = JSON.stringify(curlObj.body)
                            } catch (e) { }
                            rawRequest += `\r\n${body}`
                        }
                    }

                } catch (e) {
                    console.log(e)
                }

                controller.parseRawRequest(rawRequest, opts, formId).then(function (obj) {
                    if (obj) {
                        controller.waiting = true
                        $form.form('set value', 'request_method', obj.request.method)
                        $form.form('set value', 'request_url', obj.request.target)
                        $form.form('set value', 'request_protocol', obj.request.scheme)
                        $form.form('set value', 'request', obj.request.raw)
                        let { jwtToken, decodedToken } = jwtHelper.checkToken(obj.request.raw)
                        if (jwtToken) {
                            $('#' + formId + ' #jwt_btn').show()
                            //$('.item.jwt').tab()
                            console.log(jwtToken)
                        }
                        controller.waiting = false
                    }
                    // let editor = CodeMirror.fromTextArea(document.getElementsByName('request')[0], {
                    //     lineNumbers: false, lineWrapping: false, mode: "message/http",
                    //     scrollbarStyle: null
                    // })
                    // editor.setSize('auto', '100%')
                }).catch(function (e) {
                    $('#traffic_error_message').text(e)
                    $('.mini.modal').modal('show')
                })
            }

        } catch (e) {
            $('#traffic_error_message').text(e)
            $('.mini.modal').modal('show')
        }
    })

    $(document).on("update_raw_request", function (e, formId) {
        let $form = $('#' + formId + ' #request_form')
        let values = $form.form('get values')
        if (!values.request && !values.request_url) return



        let opts = {
            override_headers: values['override_headers'] == 'on' ? true : false,
            follow_redirect: values['follow_redirect'] == 'on' ? true : false,
            update_content_length: values['update_content_length'] == 'on' ? true : false,
            use_content_type: values['use_content_type'] == 'on' ? true : false
        }

        if (values.request.trim() == "") {
            let target = values.request_protocol + '://' + values.request_url.replace(/^https?:\/\//, '')
            values.request = [`${values.request_method} ${target} HTTP/1.1`, '', ''].join('\r\n')
        }

        let params = {
            'request_method': values.request_method,
            'request_url': values.request_url,
            'request_protocol': values.request_protocol
        }

        controller.parseRawRequest(values['request'], opts, formId).then(function (schema) {
            console.log(schema)
            controller.updateRawRequest(schema, params, opts, formId).then(function (obj) {
                controller.waiting = true
                $form.form('set value', 'request_method', obj.request.method)
                $form.form('set value', 'request_url', obj.request.target)
                $form.form('set value', 'request_protocol', obj.request.scheme)
                $form.form('set value', 'request', obj.request.raw)
                controller.waiting = false
            }).catch(function (e) {
                $('#traffic_error_message').text(e)
                $('.mini.modal').modal('show')
            })
        })
    })

    $(document).on("send_request", function (e, index) {
        let formId = 'request_' + index
        let $form = $('#' + formId + ' #request_form'), formIndex = $('#' + formId).attr('index')
        $form.form('set value', 'response_headers', '')
        $form.form('set value', 'response_body', '')
        $form.form('validate form')

        if ($form.form('is valid')) {
            let values = $form.form('get values')

            let opts = {
                override_headers: values['override_headers'] == 'on' ? true : false,
                follow_redirect: values['follow_redirect'] == 'on' ? true : false,
                update_content_length: values['update_content_length'] == 'on' ? true : false,
                use_content_type: values['use_content_type'] == 'on' ? true : false
            }

            controller.parseRawRequest(values['request'], opts, formId).then(function (schema) {
                controller.sendRequest(schema, formId).then((result) => {
                    let strHeaders = result.response.statusLine + '\r\n' + result.response.headers.map(x => { return x.name + ": " + x.value }).join('\r\n')
                    $form.form('set value', 'response_headers', strHeaders)
                    $form.form('set value', 'response_body', result.response.body)
                }).catch(function (error) {
                    $('#traffic_error_message').text(error)
                    $('.mini.modal').modal('show')
                })
            })
        }
    })

    $(document).on("scan_request", function (e, formId) {
        $('.ui.sidebar')
            .sidebar('setting', 'transition', 'overlay')
            .sidebar('toggle')
            .sidebar('toggle')
        //$('.dimmer').show()
        let $form = $('#' + formId + ' #request_form'), formIndex = $('#' + formId).attr('index')
        $form.form('validate form')

        if ($form.form('is valid')) {
            let values = $form.form('get values')
            let opts = {
                override_headers: values['override_headers'] == 'on' ? true : false,
                follow_redirect: values['follow_redirect'] == 'on' ? true : false,
                update_content_length: values['update_content_length'] == 'on' ? true : false,
                use_content_type: values['use_content_type'] == 'on' ? true : false
            }

            $('#' + formId + ' .showScanResult').show()
            controller.parseRawRequest(values['request'], opts, formId).then(function (schema) {
                controller.scanRequest(schema, formId)
            })
        }
    })

    $(document).on("add_request", function (event, data) {
        let newIndex = data.index

        let $form = $('#request_' + newIndex + ' #request_form')
        if (!$form.length) {
            let count = $('.tab.request').length + 1

            $("#pagecontent .tab.request").removeClass('active')
            $("#pagecontent .menu_item").removeClass('active')

            let newItem = `<tr style="box-shadow: none;"><td style="padding:0px;border-top: 0px !important;"><div class="ui mini menu_item active button" id="tab_${newIndex}" index="${newIndex}" style="width: 100%;margin-bottom: 1px">${count}<i class="window close icon"></i></div></td></tr>`
            $('.menu_item').last().parent().parent().after(newItem)

            $(".tab.request").last().after($("#request_0").
                clone().
                attr('id', 'request_' + newIndex).
                attr('index', newIndex).
                attr('data-tab', 'tab_' + newIndex)
            )
            $(`#request_${newIndex}  #request_form .showScanResult`).hide()
            $("#request_" + newIndex).addClass('active')
            $(document).trigger("reset_form", 'request_' + newIndex)
        }
        controller.waiting = true
        if (data?.request?.raw) {
            $form = $(`#request_${newIndex} #request_form`)
            $form.form('set values', {
                'request': data.request.raw,
                'follow_redirect': data.request.opts.follow_redirect,
                'update_content_length': data.request.opts.update_content_length,
                'use_content_type': data.request.opts.use_content_type
            })
            if (data.response) {
                $form.form('set values', {
                    'response_headers': (data.response.statusLine + '\r\n' + data.response.headers.map(x => { return x.name + ": " + x.value }).join('\r\n')).trim(),
                    'response_body': data.response.body
                })
            }
            $(document).trigger("parse_request", 'request_' + newIndex)
        }

        if (data?.operation == 'clone') {
            let $formFrom = $('#request_' + data.from + ' #request_form'),
                values = $formFrom.form('get values')
            let $formTo = $('#request_' + newIndex + ' #request_form')
            $formTo.form('set values', { 'request': values['request'] })
            $(document).trigger("parse_request", 'request_' + newIndex)
        }

        if (data?.operation == 'proxy_request') {
            $(document).trigger("init_request", [data.request, "request_" + newIndex])
        }
        if (data?.operation == 'rattacker_request') {
            let $rAttckerForm = $('#request_' + newIndex + ' #request_form')
            $rAttckerForm.form('set values', { 'request': data.request })
            $(document).trigger("parse_request", 'request_' + newIndex)
        }
        controller.waiting = false

        $('.ui.dropdown').dropdown({ on: 'click' })
        $('.question').popup()
    })

    $('.settings').on('click', function () {
        $('#request_settings_container').modal("show")
    })
    $(document).on("click", ".settings.icon", function () {
        let index = parseInt($('.tab.request').last().attr('index'))
        $(this).closest('.ui.tab.active .form').find('.request_settings_container').show()
    })


    // $('#closesettings').on('click', function () {
    //     $('#request_settings_container').hide("slow")
    //     $('.request_forms_container').show("slow")
    // })

    $('.send_rbuilder').on("click", function () {
        let request = $('#raw_request').val().trim()
        window.location.href = "rbuilder.html?rawRequest=" + btoa(encodeURIComponent(JSON.stringify(request)))
        return false
    })

    $('#add_request').on('click', function () {
        let newIndex = parseInt($(".tab.request").last().attr('index')) + 1
        $(document).trigger('add_request', { index: newIndex })
    })

    $(document).on("submit", ".tiny.form", function (e) {
        e.preventDefault()
        return false
    })

    $(document).on("click", ".showScanResult", function () {
        resetScanResult()
        let key = $(this).closest('.ui.tab.active').attr('id')
        controller.init().then(function (result) {

            if (result[key].scanResult) {
                $('#' + key + ' #request_form .showScanResult').show()
                bindScanResult(result[key].scanResult)
            }
        })
        $('.ui.sidebar')
            .sidebar('setting', 'transition', 'overlay')
            .sidebar('toggle')
            .sidebar('toggle')
    })

    $(document).on("click", ".hideScanResult", function () {

        $('.ui.sidebar')
            .sidebar('setting', 'transition', 'overlay')
            .sidebar('toggle')
            .sidebar('toggle')
    })

    $(document).on("click", ".copy_icon", function () {
        let index = $(this).closest('.ui.tab.active').attr('id')
        let $form = $('#' + index + ' #request_form'), values = $form.form('get values'),
            text = values['request']
        navigator.clipboard.writeText(text);
    })

    $(document).on("click", ".clone_icon", function () {
        let index = parseInt($('.tab.request').last().attr('index'))
        let from = parseInt($(this).closest('.ui.tab.active').attr('index'))
        $(document).trigger('add_request', { operation: 'clone', index: index + 1, from: from })
    })

    $(document).on("click", ".clear", function () {
        let index = $(this).closest('.ui.tab.active').attr('id')
        controller.clear(index)
        $(document).trigger("reset_form", index)
    })

    $(document).on("click", ".resetall", function () {
        controller.resetAll()
        $('#pagecontent .menu_item').each(function (i, obj) {
            let index = parseInt($(obj).attr('index'))
            $(document).trigger("reset_form", index)
            if (index) {
                $('#tab_' + index).parent().parent().remove()
                $('#request_' + index).remove()
            }
        })
        $("#request_0").addClass('active')
        let $form = $('#request_0 #request_form')
        $form.form('set values', {
            'request': '',
            'response_headers': '',
            'response_body': ''
        })
    })

    $(document).on("click", ".send", function () {
        $(`#request_${$(this).closest('.ui.tab.active').attr('index')}  #request_form .showScanResult`).hide()
        $(document).trigger("send_request", $(this).closest('.ui.tab.active').attr('index'))
    })

    $(document).on("click", ".scan", function () {
        resetScanResult()
        let key = $(this).closest('.ui.tab.active').attr('id')
        $(document).trigger("scan_request", key)
    })

    $(document).on("click", ".window.close.icon", function () {
        let index = $(this).parent().attr('index')
        $('#tab_' + index).parent().parent().remove()
        $('#request_' + index).remove()
        $(".menu_item").removeClass('active')
        $(".tab.request").removeClass('active')
        controller.deleteSavedRequest(`request_${index}`)
        setTimeout(function () {
            $('#tab_0').addClass('active')
            $('#request_0').addClass('active')
        }, 50)
    })

    $(document).on("click", ".menu_item", function () {
        $(".menu_item").removeClass('active')
        $(".tab.request").removeClass('active')
        let index = $(this).attr('index')
        $(`[id='request_${index}']`).addClass('active')
        $(this).addClass('active')
    })

    $(document).on("dblclick", ".menu_item", function () {
        $(this).attr('contentEditable', true)
        $(this).trigger('focus')
    })

    $(document).on("blur", ".menu_item", function () {
        $(this).attr('contentEditable', false)
    })

    $(document).on("click", ".showHtml", function () {
        rutils.showHtml($(this))
    })


    $(document).on("click", ".showHtmlNew", function () {
        rutils.showHtml($(this), true)
    })

    $(document).on('change', "[name=request_method], [name=request_protocol], [name=request_url], [name=follow_redirect], [name=update_content_length], [name=use_content_type]", function (e) {
        if (e.target.value != "" && !controller.waiting) {
            $(document).trigger("update_raw_request", $(this).closest('.ui.tab.active').attr('id'))
        }
    })

    $(document).on('change', "[name=request]", function (e) {
        if (e.target.value != "" && !controller.waiting) {
            $(document).trigger("parse_request", $(this).closest('.ui.tab.active').attr('id'))
        }
    })


    //  Scan handlers //

    $(document).on("bind_stats", function (e, scanResult) {
        $('#attacks_count').text(scanResult.stats.attacksCount)
        $('#vulns_count').text(scanResult.stats.vulnsCount)
        $('#high_count').text(scanResult.stats.high)
        $('#medium_count').text(scanResult.stats.medium)
        $('#low_count').text(scanResult.stats.low)

        if (scanResult.stats.vulnsCount > 0) {
            $('#filter_vuln').trigger("click")
        }
        return false
    })

    $('#filter_all').on("click", function () {
        $('.attack_info').show()
        $('#filter_vuln').removeClass('active')
        $('#filter_all').addClass('active')
    })

    $('#filter_vuln').on("click", function () {
        $('.attack_info.nonvuln').hide()
        $('#filter_all').removeClass('active')
        $('#filter_vuln').addClass('active')
    })

    $.fn.selectRange = function (start, end) {
        var e = document.getElementById($(this).attr('id')); // I don't know why... but $(this) don't want to work today :-/
        if (!e) return;
        else if (e.setSelectionRange) { e.focus(); e.setSelectionRange(start, end); } /* WebKit */
        else if (e.createTextRange) { var range = e.createTextRange(); range.collapse(true); range.moveEnd('character', end); range.moveStart('character', start); range.select(); } /* IE */
        else if (e.selectionStart) { e.selectionStart = start; e.selectionEnd = end; }
    };

    $(document).on("click", ".attack_details", function () {
        $('.metadata .item').tab()
        let requestId = $(this).attr("data-requestId")
        let index = $(this).attr("data-index")
        let attack = controller.scanResult.attacks[index]
        rutils.bindAttackDetails($(this), attack, controller.scanResult.original)
        $('.metadata .item').tab('change tab', 'first');
    })


    controller.init().then(function (result) {
        let newIndex = 0
        Object.keys(result).sort(function (a, b) { return a.split('_')[1] - b.split('_')[1] }).forEach(function (key) {
            newIndex = parseInt(key.split('_')[1])
            $(document).trigger('add_request', { request: result[key].request, response: result[key].response, index: newIndex })
            if (result[key].scanResult) {
                $(`#request_${newIndex}  #request_form .showScanResult`).show()
            }
            newIndex++
        })

        let params = new URLSearchParams(window.location.search)
        if (params.has('requestDetails')) {
            let request = JSON.parse(decodeURIComponent(atob(params.get('requestDetails'))))
            $(document).trigger('add_request', { operation: 'proxy_request', request: request, index: newIndex })
        }
        if (params.has('rawRequest')) {
            let request = JSON.parse(decodeURIComponent(atob(params.get('rawRequest'))))
            $(document).trigger('add_request', { operation: 'rattacker_request', request: request, index: newIndex })

        }
        $('.ui.dropdown').dropdown({ on: 'click' })
        $('.question').popup()
    })

    $(document).on("click", "#jwt_btn", function () {
        let index = $(this).closest('.ui.tab.active').attr('id')
        let $form = $('#' + index + ' #request_form'), values = $form.form('get values'),
            text = values['request']
        let { jwtToken, decodedToken } = jwtHelper.checkToken(text)
        if (jwtToken) {
            //Decoded
            let jwt = JSON.parse(decodedToken)
            $('#jwt_header').text(JSON.stringify(jwt['header'], null, 2))
            $('#jwt_payload').text(JSON.stringify(jwt['payload'], null, 2))
            $('#jwt_token').val(jwtToken[0])

        }
        $('#jwt_dlg').modal('show')
    })

    $('.jwt_token_copy').on("click", function () {
        navigator.clipboard.writeText($('#jwt_token').val())
    })




})

function resetScanResult() {
    $("#progress_message").hide()
    $('#attacks_info').html("")
    $('#filter_vuln').removeClass('active')
    $('#filter_all').addClass('active')
    $(document).trigger("bind_stats", { stats: { attacksCount: 0, vulnsCount: 0, high: 0, medium: 0, low: 0 } })
}

function bindScanResult(result) {
    //$('.dimmer').hide()
    $("#progress_message").hide()
    if (result) {
        $('#attacks_info').html("")
        if (!result.original) {
            $('#attacks_info').html(`<div class="ui medium message attack_info" style="position:relative; margin-top: 0;">Could not execute requests</div>`)
        }
        controller.scanResult = result
        for (let j = 0; j < result.attacks.length; j++) {
            $("#attacks_info").append(rutils.bindAttack(result.attacks[j], result.original, j))
        }
        rutils.sortAttacks()
        $(document).trigger("bind_stats", result)
    }
}
function bindAttackProgress(message) {
    $("#progress_attack_name").text(message.info.name)
    $("#progress_message").show()
}


////////////////////////////////////
/* Chrome runtime events handlers */
////////////////////////////////////
browser.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.channel == "ptk_background2popup_rattacker") {
        if (message.type == "attack completed") {
            bindAttackProgress(message)
        }
    }
    if (message.channel == "ptk_background2popup_rbuilder") {
        if (message.type == "scan completed") {
            bindScanResult(message.scanResult)
        }
        if (message.type == "attack failed") {
            $('#scan_error_message').text(message.info)
            $('.mini.modal').modal('show')
        }
    }
})