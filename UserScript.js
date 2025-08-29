// ==UserScript==
// @name         DeepSeek Chat History GETer
// @namespace    github.com/mz31415/DeepSeekChatWebHistoryGET
// @version      1.0
// @description  DeepSeek网站的聊天记录提取工具, 可配合服务器(通过本地端口3141), 实现上传与保存
// @author       MZ、DS
// @match        https://chat.deepseek.com/*
// @grant        GM_xmlhttpRequest
// @icon         https://cdn.deepseek.com/chat/icon.png 
// ==/UserScript==

(function() {
    'use strict';
    // 存储复制内容的数组
    let copiedContents = [];
    const SERVER_URL = 'http://localhost:3141/get';

    // 配置参数
    const TheMain = 'div.dad65929'; // 聊天消息的主容器
    const ChatMaessages ='div[class^="ds-flex _"]'; // 聊天消息的容器
    const CopyButton = 'div.ds-icon-button'; // 聊天消息的复制按钮
    const AIsign = 'ds-flex'; // AI消息标志容器

    const Buttons ='div.ec4f5d61'; // 功能按钮容器(聊天记录按钮父容器)
    const AButton ='div[role="button"]'; // 功能按钮模版
    const AButtonIcon = 'div.ds-button__icon'; // 功能按钮图标名称
    const AButtonSpan = 'span.ad0c98fd'; // 功能按钮文本名称

    let canCopy = true; // 是否允许复制
    let isCopying = false; // 是否正在复制
    let progress = 0; // 进度(*100,百分比)
    let len = 0; // 用于验证的总消息数目

    function copyAllChatMessages() {
        // showNotification('(๑•̀ㅂ•́)و✧正在提取聊天记录，请稍候...'); // 这句提示与进度条的显示冲突
        console.log('开始提取聊天记录...');

        // 重置存储数组
        copiedContents = [];

        // 查找目标容器
        const mainContainer = document.querySelector(TheMain);
        if (!mainContainer) {
            console.error(`找不到主容器 ${TheMain}`);
            showNotification('错误: 找不到聊天容器 ( •́ _ •̀)？');
            cancel();
            canCopy = true;
            isCopying = false;
            return;
        }

        // 获取页面标题并清理
        const rawTitle = document.querySelector('head > title')?.textContent || 'DeepSeek对话记录';
        const chatTitle = cleanTitle(rawTitle);
        console.log('对话标题:', chatTitle);

        // 查找所有匹配的聊天消息容器
        const chatContainers = mainContainer.querySelectorAll(ChatMaessages);
        len = chatContainers.length;
        console.log(`找到 ${len} 条聊天消息`);

        if (len === 0) {
            console.warn('未找到聊天消息');
            showNotification('( º﹃º ) 未找到聊天消息');
            cancel();
            canCopy = true;
            isCopying = false;
            return;
        }

        progress = 0;
        // 依次处理每条消息
        processMessagesSequentially(chatContainers, 0, chatTitle);
    }

    function cleanTitle(title) {
        // 去除结尾的 " - DeepSeek" 字符串
        return title.replace(/\s*-\s*DeepSeek\s*$/, '').trim() || 'DeepSeek对话记录';
    }

    function processMessagesSequentially(containers, index, chatTitle) {
        if (!canCopy){
            console.log('用户取消了操作');
            showNotification('(˘･_･˘) 已取消提取操作');
            canCopy = true;
            isCopying = false;
            return;
        }
        if (index !== copiedContents.length){
            console.warn(`消息索引不匹配: 预期 ${copiedContents.length}, 实际 ${index}`);
            showNotification(`( •́ὤ•̀) 消息数目不匹配,请误切换对话.`);
            cancel();
            canCopy = true;
            isCopying = false;
            return;
        }

        if (index >= containers.length) {
            if (copiedContents.length !== len){
                console.warn(`最终消息数目不匹配: 预期 ${len}, 实际 ${copiedContents.length}`);
                showNotification(`( •́ὤ•̀) 消息数目不匹配,请误切换对话.`);
                cancel();
                canCopy = true;
                isCopying = false;
                return;
            }
            console.log('所有消息复制完成！');
            console.log(`共复制 ${copiedContents.length} 条消息`);

            // 显示统计信息
            const aiCount = copiedContents.filter(item => item.role === 'assistant').length;
            const userCount = copiedContents.filter(item => item.role === 'user').length;
            console.log(`assistant: ${aiCount} 条, user: ${userCount} 条`);

            uploadToServer(chatTitle);

            cancel();
            canCopy = true;
            isCopying = false;
            return;
        }
        console.log(`已处理 ${index} / ${containers.length} 条消息，继续中...`);

        let newprogress = Math.round(100*index/containers.length);
        if (progress !== newprogress){
            showNotification(`进度条${progress}%`);
            progress = newprogress;
        }
        

        const container = containers[index];
        const copyButton = container.querySelector(CopyButton);

        if (!copyButton) {
            console.warn(`第 ${index + 1} 条消息未找到复制按钮, 或可通过取消其的编辑状态解决.`);
            showNotification(`( •́ὤ•̀) 第 ${index + 1} 条消息状态错误, 或可通过取消其的编辑状态解决.`)
            cancel();
            canCopy = true;
            isCopying = false;
            return;
        }

        // 判断消息类型
        const messageType = determineMessageType(container);

        // 创建自定义事件来捕获复制的内容
        const originalWriteText = navigator.clipboard.writeText;
        navigator.clipboard.writeText = function(text) {
            
            copiedContents.push({
                index: index,
                role: messageType,
                content: text.trim()
            });
            navigator.clipboard.writeText = originalWriteText;
            return Promise.resolve();
        };

        // 点击复制按钮
        copyButton.click();

        // 添加延迟确保复制操作完成
        setTimeout(() => {
            processMessagesSequentially(containers, index + 1, chatTitle);
        }, 50);
    }

    function determineMessageType(container) {
        // 向上查找父元素，判断是否为AI消息
        let parent = container.parentElement;
        while (parent) {
            if (parent.classList.contains('ds-flex')) {
                // 检查父元素是否只有 ds-flex 类（没有其他下划线开头的类）
                const hasOtherClasses = Array.from(parent.classList).some(className =>
                    className.startsWith('_') && className !== AIsign
                );

                if (!hasOtherClasses && parent.classList.length === 1) {
                    return 'assistant';
                }
                break;
            }
            parent = parent.parentElement;
        }
        return 'user';
    }

    function uploadToServer(chatTitle) {
        if (copiedContents.length === 0) {
            console.warn('没有内容可上传');
            showNotification('(˘•ω•˘) 没有内容可上传');
            return;
        }

        console.log('正在上传聊天记录到服务器...');
        showNotification('٩(๑•̀ω•́๑)۶ 正在上传聊天记录...');

        GM_xmlhttpRequest({
            method: 'POST',
            url: SERVER_URL,
            headers: {
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({
                title: chatTitle,
                timestamp: new Date().toISOString(),
                total_messages: copiedContents.length,
                messages: copiedContents
            }),
            onload: function(response) {
                if (response.status === 200) {
                    console.log('上传成功');
                    showNotification('(≧∀≦)ゞ 聊天记录上传成功！请到服务器查看是否保存成功。');
                } else {
                    console.error('上传失败:', response.status);
                    showNotification('(*ﾟーﾟ) 上传失败，请检查服务器。或按F12到控制台查看日志。');
                    console.log("提取的历史记录如下:");
                    console.log(copiedContents);
                }
            },
            onerror: function(error) {
                console.error('上传失败:', error);
                showNotification('(*ﾟーﾟ) 上传失败，请检查服务器。或按F12到控制台查看日志。');
                console.log("提取的历史记录如下:");
                console.log(copiedContents);
            },
            timeout: 10000
        });
    }

    function showNotification(message) {
        // 移除旧的提示框
        const oldNotification = document.getElementById('chat-copy-notification');
        if (oldNotification) {
            oldNotification.remove();
        }

        // 创建新的提示框
        const notification = document.createElement('div');
        notification.id = 'chat-copy-notification';
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.background = 'rgba(0,0,0,0.8)';
        notification.style.color = 'white';
        notification.style.padding = '15px';
        notification.style.borderRadius = '8px';
        notification.style.zIndex = '9999';
        notification.style.fontFamily = 'Arial, sans-serif';
        notification.style.fontSize = '14px';
        notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        notification.textContent = message;

        document.body.appendChild(notification);

        // 3秒后自动消失
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    function initButton() {
        // 查找目标容器
        const container = document.querySelector(Buttons);
        if (!container) {
            console.log('未找到功能按钮容器，“聊天记录提取”按钮添加失败');
            showNotification('Ծ‸Ծ “聊天记录提取”按钮添加失败，请使用F6键。');
            return;
        }

        // 获取现有按钮作为模板
        const existingButtons = container.querySelectorAll(AButton);
        if (existingButtons.length < 2) {
            console.log('功能按钮数目不正常，“聊天记录提取”按钮添加失败');
            showNotification('Ծ‸Ծ “聊天记录提取”按钮添加失败，请使用F6键。')
            return;
        }
        
        // 克隆第一个按钮作为模板
        window.templateButton = existingButtons[0].cloneNode(true);
        
        // 删除图标子元素
        const iconDiv = window.templateButton.querySelector(AButtonIcon);
        if (iconDiv) {
            iconDiv.remove();
        }
        
        // 修改文本内容
        const span = window.templateButton.querySelector(AButtonSpan);
        if (span) {
            span.textContent = '聊天记录提取';
        }
        
        // 添加点击事件
        window.templateButton.addEventListener('click', checkAndCopy);
        
        // 设置新按钮样式
        window.templateButton.style.position = 'absolute';
        window.templateButton.style.right = '10%';
        
        // 添加到容器中
        container.style.position = 'relative'; // 确保容器是相对定位
        container.appendChild(window.templateButton);
    }

    // 等待页面加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initButton);
    } else {
        setTimeout(initButton, 1000);
    }

    function checkAndCopy(){
        const span = window.templateButton.querySelector(AButtonSpan);
        span.textContent = ' 取 消 ';
        window.templateButton.removeEventListener('click', checkAndCopy);
        window.templateButton.addEventListener('click', cancel);
        isCopying = true;
        copyAllChatMessages();
    }
    
    function cancel(){
        canCopy = false;
        const span = window.templateButton.querySelector(AButtonSpan);
        span.textContent = '聊天记录提取';
        window.templateButton.removeEventListener('click', cancel);
        window.templateButton.addEventListener('click', checkAndCopy);
    }

    // 监听F6键
    document.addEventListener('keydown', function(event) {
        if (event.key === 'F6') {
            // 阻止F6默认行为（如有）
            event.preventDefault();
            event.stopPropagation();
            if (isCopying){
                cancel()
            } else{
                checkAndCopy()
            }

            
        }
    });

    showNotification("ρ(・ω・、) 按“聊天记录提取”按钮 或 按F6键 请求提取聊天记录。");
    console.log('本脚本来自 http://github.com/mz31415/DeepSeekChatWebHistoryGET')
    console.log('DeepSeek聊天记录提取脚本已加载，按“聊天记录提取”按钮 或 按F6键 请求提取聊天记录');
})();
// - ω -