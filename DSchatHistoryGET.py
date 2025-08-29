#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""- ω -
Deepseek Chat History GETer v1.0 
接收油猴脚本数据, 得到DeepSeek网站聊天记录, 并保存为JSON和Markdown格式
来自 github.com/mz31415/DeepSeekChatWebHistoryGET
"""

import logging, json, os
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('Deepseek_Chat_History_GET.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

class ChatRequestHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/get':
            self.handle_chat_upload()
        else:
            self.send_error(404, "Endpoint not found")
    
    def handle_chat_upload(self):
        try:
            # 读取请求数据
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            # 解析JSON数据
            chat_data = json.loads(post_data.decode('utf-8'))
            
            # 记录接收信息
            title = chat_data.get('title', '未命名对话')
            logging.info(f"收到聊天记录: '{title}', 共 {chat_data['total_messages']} 条消息")
            
            # 保存到文件
            self.save_chat_data(chat_data)
            
            # 发送成功响应
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            response = {'status': 'success', 'message': 'Chat data received and saved'}
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            logging.error(f"处理请求时出错: {e}")
            self.send_error(500, f"Internal server error: {str(e)}")
    
    def save_chat_data(self, chat_data):
        """保存聊天数据到文件"""
        # 创建保存目录
        save_dir = os.path.dirname(__file__) + "\\DSchatHistory\\"
        os.makedirs(save_dir, exist_ok=True)
        
        # 清理标题中的非法文件名字符
        title = chat_data.get('title', '未命名的对话')
        chat_data["title"] = title
        safe_title = self.sanitize_filename(title)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # 保存原始JSON数据
        json_filename = os.path.join(save_dir, f"{safe_title}_{timestamp}.json")
        with open(json_filename, 'w', encoding='utf-8') as f:
            json.dump(chat_data, f, ensure_ascii=False, indent=2)
        logging.info(f"原始数据已保存到: {json_filename}")
        
        # 保存Markdown格式
        md_filename = os.path.join(save_dir, f"{safe_title}_{timestamp}.md")
        self.save_as_markdown(chat_data, md_filename)
        logging.info(f"Markdown格式已保存到: {md_filename}")
    
    def save_as_markdown(self, chat_data, filename):
        """保存为Markdown格式"""
        title = chat_data['title']
        total_messages = chat_data.get('total_messages', 0)
        
        with open(filename, 'w', encoding='utf-8') as f:
            # 写入标题和元数据
            f.write(f"# {title}\n\n")
            f.write(f"**导出时间**: {chat_data['timestamp']}  \n")
            f.write(f"**总消息数**: {total_messages}  \n")
            f.write("\n---\n\n")

            # 写入每条消息
            for message in chat_data.get('messages', []):
                message_type = message.get('role', '')

                index = message.get('index','') + 1
                content = message.get('content', '')
                
                if message_type == 'assistant':
                    f.write(f"> # {index} AI\n\n")
                    f.write(f"{content}\n\n\n")
                else:
                    f.write(f"> # {index} 用户\n\n")
                    f.write(f"{content}\n\n\n")
                
                f.write("---\n\n")
            f.write("`- ω -`")
                 
    def sanitize_filename(self, filename):
        """清理文件名中的非法字符"""
        invalid_chars = '<>:"/\\|?*'
        for char in invalid_chars:
            filename = filename.replace(char, '_')
        # 限制文件名长度
        if len(filename) > 25:
            filename = filename[:22] + '...'
        return filename.strip()
    
    def do_OPTIONS(self):
        """处理预检请求"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def log_message(self, format, *args):
        """自定义日志格式"""
        logging.info(format % args)
        print()

def run_server(port=3141):
    """启动服务器"""
    server_address = ('', port)
    httpd = HTTPServer(server_address, ChatRequestHandler)
    logging.info("\n来自 http://github.com/mz31415/DeepSeekChatWebHistoryGET\n"\
                    "给个 star 吧！ ヽ(≧ω≦*)♪\n\n"\
                    "       ╱|、_   \n"\
                    "      (˚_ 。7  \n"\
                    "      |、˜ 〵  \n"\
                    "      じしˍ,)ノ\n"
                )
    
    logging.info("聊天记录服务器启动中...")
    logging.info(f"聊天记录服务器启动在端口 {port}")
    logging.info(f"文件保存路径: {os.path.dirname(__file__)}\\DSchatHistory\\")
    logging.info("按 Ctrl+C 终止服务器")
    logging.info("如果上传时没有响应可以回车试试\n")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logging.info("(｡・ω・｡) 服务器正在关闭...")
        httpd.shutdown()
        input("服务器已关闭。按回车键退出。\n(:")
        exit(0)

if __name__ == '__main__':
    run_server()