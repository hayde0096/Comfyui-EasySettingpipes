// power_lora_info_dialog.js
// 参考 rgthree-comfy 的 dialog_info.js 实现，提供丰富的 Lora 信息展示

class PowerLoraInfoDialog {
  /**
   * LoRA 信息弹窗类
   * 
   * 功能：显示 LoRA 模型的详细信息，包括：
   * - 基础信息（文件名、哈希、大小等）
   * - 训练词汇和触发词汇
   * - Civitai 信息（如果可用）
   * - 示例图片
   * 
   * 参考 rgthree-comfy 的 dialog_info.js 实现
   * 
   * @param {string} file LoRA 文件名
   */
  constructor(file) {
    this.file = file;
    this.modelInfo = null;
    this.modifiedModelData = false;
    this.dialog = null;
    this.overlay = null;
    
    // 立即注入 CSS，确保在创建 DOM 前就有样式
    this.injectStyles();
    
    this.init();
  }

  injectStyles() {
    if (!document.getElementById('power-lora-info-styles')) {
      const style = document.createElement('style');
      style.id = 'power-lora-info-styles';
      style.textContent = `
        .power-lora-word-item {
          padding: 6px 10px;
          background: #3a3a3a;
          color: #ccc;
          border-radius: 4px;
          cursor: pointer;
          user-select: none;
          font-size: 12px;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border: 1px solid transparent;
          white-space: nowrap;
          margin-right: 4px;
        }
        
        .power-lora-word-item:hover {
          background: #4a4a4a;
        }
        
        .power-lora-word-item.-selected {
          background: #4a9eff !important;
          color: #fff !important;
          border-color: #2a7fd9 !important;
        }

        /* 滚动条样式优化 */
        .power-lora-words-container::-webkit-scrollbar {
          width: 8px;
        }
        
        .power-lora-words-container::-webkit-scrollbar-track {
          background: #1a1a1a;
          border-radius: 4px;
        }
        
        .power-lora-words-container::-webkit-scrollbar-thumb {
          background: #444;
          border-radius: 4px;
        }
        
        .power-lora-words-container::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
        
        /* Firefox 滚动条样式 */
        .power-lora-words-container {
          scrollbar-width: thin;
          scrollbar-color: #444 #1a1a1a;
        }
      `;
      document.head.appendChild(style);
    }
  }

  async init() {
    try {
      this.modelInfo = await this.getModelInfo(this.file);
      this.createDialog();
    } catch (error) {
      this.createSimpleDialog();
    }
  }

  async getModelInfo(file) {
    try {
      const response = await fetch(`/api/easy_setting/loras/info?file=${encodeURIComponent(file)}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      // 返回最小化的信息对象，至少显示文件名
      return { file: file };
    }
  }

  createDialog() {
    const info = this.modelInfo || {};
    
    // 创建遮罩层
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.6);
      z-index: 9999;
    `;
    this.overlay.onclick = () => this.close();

    // 创建对话框
    this.dialog = document.createElement('div');
    this.dialog.className = 'power-lora-info-dialog';
    this.dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #2a2a2a;
      border: 1px solid #555;
      border-radius: 8px;
      width: 90%;
      max-width: 700px;
      max-height: 80vh;
      z-index: 10000;
      color: #ccc;
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      box-shadow: 0 8px 32px rgba(0,0,0,0.7);
      display: flex;
      flex-direction: column;
    `;

    // 标题栏
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 16px 20px;
      border-bottom: 1px solid #444;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    
    const title = document.createElement('h3');
    title.style.cssText = `
      margin: 0;
      font-size: 18px;
      color: #fff;
    `;
    title.textContent = info.name || info.file || "Unknown";
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: #aaa;
      font-size: 28px;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeBtn.onmouseover = () => closeBtn.style.color = '#fff';
    closeBtn.onmouseout = () => closeBtn.style.color = '#aaa';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      this.close();
    };
    
    header.appendChild(title);
    header.appendChild(closeBtn);

    // 内容区
    const content = document.createElement('div');
    content.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    `;
    
      try {
        content.innerHTML = this.getInfoContent();
      } catch (error) {
        content.innerHTML = `<p style="color: #f44;">生成内容时出错: ${error.message}</p>`;
      }

    this.dialog.appendChild(header);
    this.dialog.appendChild(content);
    
    document.body.appendChild(this.overlay);
    document.body.appendChild(this.dialog);

    // 附加事件监听
    this.attachEvents(content);
  }

  attachEvents(contentElement) {
    if (contentElement._eventsAttached) {
      return;
    }
    
    contentElement._eventsAttached = true;

    contentElement.addEventListener('click', async (e) => {
      let target = e.target;
      
      // 往上找到有 data-action 的元素，最多往上找 10 层
      let depth = 0;
      while (target && !target.getAttribute?.('data-action') && depth < 10) {
        target = target.parentElement;
        depth++;
      }
      
      if (!target) {
        return;
      }
      
      // 立即阻止事件冒泡，防止重复处理
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      const action = target.getAttribute('data-action');
      
      if (action === 'fetch-civitai') {
        target.disabled = true;
        target.textContent = '加载中...';
        try {
          this.modelInfo = await this.fetchFromCivitai(this.file);
          const content = contentElement;
          content._eventsAttached = false;
          content.innerHTML = this.getInfoContent();
          this.attachEvents(content);
        } catch (error) {
          // 静默处理错误
        } finally {
          target.disabled = false;
          target.textContent = '从 Civitai 获取信息';
        }
      } else if (action === 'toggle-trained-word') {
        // 切换选中状态
        target.classList.toggle('-selected');
        
        // 直接修改背景色
        if (target.classList.contains('-selected')) {
          target.style.backgroundColor = '#4a9eff';
          target.style.color = '#fff';
          target.style.borderColor = '#2a7fd9';
        } else {
          target.style.backgroundColor = '';
          target.style.color = '';
          target.style.borderColor = '';
        }
        
        // 找到最近的 tr（表格行），然后更新该行的统计和复制按钮
        const tr = target.closest('tr');
        if (tr) {
          // 在第一列的 span 内添加小的统计文本
          const span = tr.querySelector('td:first-child > span');
          let small = tr.querySelector('td:first-child > small');
          
          if (!small) {
            small = document.createElement('small');
            span?.parentElement?.appendChild(small);
          }
          
          // 统计该行内所有选中的词汇
          const selected = tr.querySelectorAll('[data-action="toggle-trained-word"].-selected');
          const num = selected.length;
          
          if (num > 0) {
            small.innerHTML = `${num} 个已选 | <span role="button" data-action="copy-trained-words" style="color: #4a9eff; cursor: pointer; text-decoration: underline;">复制</span>`;
          } else {
            small.innerHTML = '';
          }
        }
      } else if (action === 'copy-trained-words') {
        // 找到该行，复制所有选中的词汇
        const tr = target.closest('tr');
        if (tr) {
          const selected = tr.querySelectorAll('[data-action="toggle-trained-word"].-selected');
          const words = Array.from(selected).map(el => el.getAttribute('data-word')).join(', ');
          if (words) {
            await navigator.clipboard.writeText(words);
            
            // 在词汇显示区域内显示复制成功提示
            const wordsContainer = tr.querySelector('.power-lora-words-container');
            if (wordsContainer) {
              // 创建临时提示元素
              const notification = document.createElement('div');
              notification.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #4a9eff;
                color: #fff;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 1;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                animation: fadeInOut 2s ease-in-out;
              `;
              notification.textContent = `已复制 ${selected.length} 个关键词`;
              
              // 添加动画样式
              if (!document.getElementById('power-lora-inline-notification-styles')) {
                const style = document.createElement('style');
                style.id = 'power-lora-inline-notification-styles';
                style.textContent = `
                  @keyframes fadeInOut {
                    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                    20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                  }
                `;
                document.head.appendChild(style);
              }
              
              // 设置容器为相对定位以便绝对定位提示
              wordsContainer.style.position = 'relative';
              wordsContainer.appendChild(notification);
              
              // 2秒后自动移除提示
              setTimeout(() => {
                notification.remove();
              }, 2000);
            }
          }
        }
      }
    });
  }

  async fetchFromCivitai(file) {
    try {
      const response = await fetch(`/api/easy_setting/loras/info?file=${encodeURIComponent(file)}&civitai=true`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return data;
    } catch (error) {
      return this.modelInfo;
    }
  }

  async refreshModelInfo(file) {
    try {
      // 使用我们自己的 API 端点
      const response = await fetch(`/api/easy_setting/loras/info?file=${encodeURIComponent(file)}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return data;
    } catch (error) {
      return { file: file };
    }
  }

  getInfoContent() {
    const info = this.modelInfo || {};
    let html = '';

    // 标签区域
    html += `<div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">`;
    if (info.type) {
      html += `<span style="background: #444; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${this.escapeHtml(info.type)}</span>`;
    }
    if (info.baseModel) {
      html += `<span style="background: #444; padding: 4px 8px; border-radius: 4px; font-size: 12px;">Base: ${this.escapeHtml(info.baseModel)}</span>`;
    }
    html += `</div>`;

    // 信息表格
    html += `<table style="width: 100%; border-collapse: collapse;">`;

    if (info.file) {
      html += this.infoTableRow("文件", this.escapeHtml(info.file));
    }
    if (info.sha256) {
      html += this.infoTableRow("Hash (SHA256)", `<code style="font-size: 11px; color: #999; word-break: break-all;">${this.escapeHtml(info.sha256)}</code>`);
    }
    if (info.name) {
      html += this.infoTableRow("名称", this.escapeHtml(info.name));
    }

    // Civitai 链接
    if (info.links && Array.isArray(info.links) && info.links.length > 0) {
      const civitaiLink = info.links.find(l => l && l.includes('civitai.com'));
      if (civitaiLink) {
        html += this.infoTableRow(
          "Civitai",
          `<a href="${this.escapeHtml(civitaiLink)}" target="_blank" style="color: #4a9eff;">查看 Civitai</a>`
        );
      }
    } else if (!info.raw?.civitai || info.raw?.civitai?.error) {
      html += this.infoTableRow(
        "Civitai",
        `<button data-action="fetch-civitai" style="padding: 4px 12px; background: #555; color: #fff; border: none; border-radius: 4px; cursor: pointer;">从 Civitai 获取信息</button>`
      );
    }

    // 强度范围
    if (info.strengthMin !== undefined && info.strengthMin !== null) {
      html += this.infoTableRow("推荐强度最小值", String(info.strengthMin));
    }
    if (info.strengthMax !== undefined && info.strengthMax !== null) {
      html += this.infoTableRow("推荐强度最大值", String(info.strengthMax));
    }

    // 分离本地训练词汇和Civitai触发词汇
    const localWords = [];
    const civitaiWords = [];
    
    if (info.trainedWords && Array.isArray(info.trainedWords)) {
      for (const wordData of info.trainedWords) {
        if (typeof wordData === 'object' && wordData.civitai === true) {
          civitaiWords.push(wordData);
        } else {
          localWords.push(wordData);
        }
      }
    }
    
    // 优先显示Civitai触发词汇
    if (civitaiWords.length > 0) {
      const civitaiWordsHtml = this.getTrainedWordsMarkup(civitaiWords, true);
      html += this.infoTableRow("触发词汇 (Civitai)", civitaiWordsHtml, true);
    }
    
    // 显示本地训练词汇
    if (localWords.length > 0) {
      const localWordsHtml = this.getTrainedWordsMarkup(localWords, false);
      html += this.infoTableRow("训练词汇", localWordsHtml, true);
    }

    // 其他元数据
    if (info.raw?.metadata?.ss_clip_skip) {
      html += this.infoTableRow("Clip Skip", String(info.raw.metadata.ss_clip_skip));
    }

    // 用户备注
    if (info.userNote) {
      html += this.infoTableRow("备注", `<pre style="background: #1a1a1a; padding: 8px; border-radius: 4px; white-space: pre-wrap; word-wrap: break-word; margin: 0;">${this.escapeHtml(info.userNote)}</pre>`);
    }

    html += `</table>`;

    // 图片展示
    if (info.images && Array.isArray(info.images) && info.images.length > 0) {
      html += `<div style="margin-top: 20px; border-top: 1px solid #444; padding-top: 16px;">`;
      html += `<h4 style="margin: 0 0 12px 0;">示例图片</h4>`;
      html += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">`;
      
      for (const img of info.images) {
        html += `<figure style="margin: 0; text-align: center;">`;
        if (img.type === 'video') {
          html += `<video src="${this.escapeHtml(img.url)}" style="width: 100%; border-radius: 4px;" autoplay loop></video>`;
        } else {
          html += `<img src="${this.escapeHtml(img.url)}" style="width: 100%; border-radius: 4px; max-height: 150px; object-fit: cover;" />`;
        }
        if (img.civitaiUrl) {
          html += `<figcaption><a href="${this.escapeHtml(img.civitaiUrl)}" target="_blank" style="color: #4a9eff; font-size: 12px;">Civitai</a></figcaption>`;
        }
        html += `</figure>`;
      }
      
      html += `</div>`;
      html += `</div>`;
    }

    return html;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  infoTableRow(label, value, isTrainedWords = false) {
    if (isTrainedWords) {
      // 训练词汇行需要预留 small 标签位置
      return `
        <tr style="border-bottom: 1px solid #3a3a3a;">
          <td style="padding: 12px 8px; width: 120px; vertical-align: top; color: #999; font-weight: 500;">
            <span>${label}</span>
          </td>
          <td style="padding: 12px 8px; color: #ccc;">${value}</td>
        </tr>
      `;
    }
    return `
      <tr style="border-bottom: 1px solid #3a3a3a;">
        <td style="padding: 12px 8px; width: 120px; vertical-align: top; color: #999; font-weight: 500;">${label}</td>
        <td style="padding: 12px 8px; color: #ccc;">${value}</td>
      </tr>
    `;
  }

  getTrainedWordsMarkup(words, isTriggerWords = false) {
    // 直接生成 li 元素，无需 ul 包装（因为在 table>tr>td 内）
    let html = ``;
    
    for (const wordData of words || []) {
      let word, count;
      
      if (typeof wordData === 'string') {
        word = wordData;
        count = null;
      } else if (typeof wordData === 'object' && wordData !== null) {
        word = wordData.word || '';
        count = wordData.count || null;
      } else {
        continue;
      }
      
      if (!word) continue;
      
      let wordsToDisplay = [word];
      if (isTriggerWords && word.includes(',')) {
        wordsToDisplay = word.split(',').map(w => w.trim()).filter(w => w.length > 0);
      }
      
      for (const singleWord of wordsToDisplay) {
        const escapedWord = this.escapeHtml(singleWord);
        const countLabel = count ? `<span style="color: #999; margin-left: 4px; font-size: 11px;">${count}</span>` : '';
        
        html += `<span class="power-lora-word-item" data-word="${escapedWord}" data-action="toggle-trained-word" title="${escapedWord}">
          <span style="display: inline;">${escapedWord}</span>
          ${countLabel}
        </span>`;
      }
    }
    
    // 包装在一个 div 中便于样式控制，添加滚动条
    return `<div class="power-lora-words-container" style="display: flex; flex-wrap: wrap; gap: 4px; align-items: flex-start; max-height: 120px; overflow-y: auto; padding: 4px; border: 1px solid #444; border-radius: 4px; background: #1a1a1a;">${html}</div>`;
  }

  createSimpleDialog() {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.6);
      z-index: 9999;
    `;
    this.overlay.onclick = () => this.close();

    this.dialog = document.createElement('div');
    this.dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #2a2a2a;
      border: 1px solid #555;
      border-radius: 8px;
      padding: 20px;
      z-index: 10000;
      color: #ccc;
      box-shadow: 0 8px 32px rgba(0,0,0,0.7);
    `;
    
    this.dialog.innerHTML = `
      <h3 style="margin-top: 0;">${this.file}</h3>
      <p>LoRA 文件: ${this.file}</p>
      <p style="color: #999; font-size: 12px;">(暂时无法获取详细信息)</p>
      <div style="margin-top: 16px; text-align: right;">
        <button onclick="this.parentElement.parentElement.remove()" style="padding: 6px 16px; background: #666; color: #fff; border: none; border-radius: 4px; cursor: pointer;">关闭</button>
      </div>
    `;

    document.body.appendChild(this.overlay);
    document.body.appendChild(this.dialog);
  }

  showNotification(message) {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      background: #4a9eff;
      color: #fff;
      padding: 12px 16px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 10001;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    // 添加动画
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(-100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(-100%);
          opacity: 0;
        }
      }
    `;
    if (!document.getElementById('power-lora-notification-styles')) {
      style.id = 'power-lora-notification-styles';
      document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // 3秒后自动移除
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }

  close() {
    if (this.dialog) this.dialog.remove();
    if (this.overlay) this.overlay.remove();
  }

  show() {
    return this;
  }
}

// 将类挂载到全局作用域，确保在浏览器中可用
if (typeof window !== 'undefined') {
  window.PowerLoraInfoDialog = PowerLoraInfoDialog;
}

export { PowerLoraInfoDialog };
