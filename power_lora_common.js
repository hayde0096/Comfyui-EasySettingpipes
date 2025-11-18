import { app } from "../../scripts/app.js";
import { PowerLoraInfoDialog } from "./power_lora_info_dialog.js";

let loraListCache = null;
let loraListPromise = null;

/**
 * 获取 LoRA 模型列表（带缓存）
 * 
 * 使用 Promise 缓存机制避免重复请求：
 * - 如果缓存存在，直接返回缓存结果
 * - 如果请求正在进行中，返回同一个 Promise
 * - 否则发起新的请求并缓存结果
 * 
 * @returns {Promise<string[]>} LoRA 文件名列表
 */
function getLoraList() {
    if (loraListCache !== null) {
        return Promise.resolve(loraListCache);
    }
    if (loraListPromise !== null) {
        return loraListPromise;
    }
    loraListPromise = fetchLoraList().then(list => {
        loraListPromise = null;
        return list;
    }).catch(err => {
        loraListPromise = null;
        return [];
    });
    return loraListPromise;
}

function fetchLoraList() {
    return fetch("/models/loras")
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            // 确保是字符串数组
            loraListCache = Array.isArray(data) ? data : [];
            return loraListCache;
        })
        .catch(error => {
            return [];
        });
}

function preloadLoraList() {
    getLoraList().catch(() => {});
}

// ===== Lora 信息弹窗 =====
function showLoraInfoDialog(loraName) {
    if (!loraName || loraName === "None") {
        return;
    }
    
    try {
        if (typeof PowerLoraInfoDialog !== 'undefined') {
            new PowerLoraInfoDialog(loraName).show();
        } else {
            // 如果 PowerLoraInfoDialog 不可用，使用其内置的简单对话框
            const dialog = new PowerLoraInfoDialog(loraName);
            dialog.createSimpleDialog();
        }
    } catch (error) {
        // 如果所有方法都失败，静默处理
        console.warn('Failed to show Lora info dialog:', error);
    }
}

function getColorFromPalette(colorType) {
    // 硬编码的 MODEL 和 CLIP 颜色
    const colors = {
        "MODEL": "#B39DDB",   // 紫色 (MODEL)
        "CLIP": "#FFD500"      // 金黄色 (CLIP)
    };
    return colors[colorType] || "#FFFFFF";
}

function isLowQuality() {
    return ((app.canvas.ds?.scale) || 1) <= 0.5;
}

function fitString(ctx, str, maxWidth) {
    let width = ctx.measureText(str).width;
    const ellipsis = "…";
    const ellipsisWidth = ctx.measureText(ellipsis).width;
    if (width <= maxWidth || width <= ellipsisWidth) {
        return str;
    }
    
    let min = 0;
    let max = str.length;
    while (min <= max) {
        let guess = Math.floor((min + max) / 2);
        const testStr = str.substring(0, guess);
        const testWidth = ctx.measureText(testStr).width;
        if (testWidth < maxWidth - ellipsisWidth) {
            min = guess + 1;
        } else {
            max = guess - 1;
        }
    }
    return str.substring(0, max) + ellipsis;
}

function drawTogglePart(ctx, options) {
    const lowQuality = isLowQuality();
    ctx.save();
    const { posX, posY, height, value } = options;
    const toggleRadius = height * 0.36;
    const toggleBgWidth = height * 1.5;
    if (!lowQuality) {
        ctx.beginPath();
        ctx.roundRect(posX + 4, posY + 4, toggleBgWidth - 8, height - 8, [height * 0.5]);
        ctx.globalAlpha = app.canvas.editor_alpha * 0.25;
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fill();
        ctx.globalAlpha = app.canvas.editor_alpha;
    }
    ctx.fillStyle = value === true ? "#89B" : "#888";
    const toggleX = lowQuality || value === false
        ? posX + height * 0.5
        : value === true ? posX + height : posX + height * 0.75;
    ctx.beginPath();
    ctx.arc(toggleX, posY + height * 0.5, toggleRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return [posX, toggleBgWidth];
}

function drawRoundedRectangle(ctx, options) {
    const lowQuality = isLowQuality();
    ctx.save();
    ctx.strokeStyle = options.colorStroke || LiteGraph.WIDGET_OUTLINE_COLOR;
    ctx.fillStyle = options.colorBackground || LiteGraph.WIDGET_BGCOLOR;
    ctx.beginPath();
    const borderRadius = lowQuality ? 0 : (options.borderRadius || options.size[1] * 0.5);
    ctx.roundRect(...options.pos, ...options.size, [borderRadius]);
    ctx.fill();
    if (!lowQuality) {
        ctx.stroke();
    }
    ctx.restore();
}

function drawNumberWidgetPart(ctx, options) {
    const arrowWidth = 9;
    const arrowHeight = 10;
    const innerMargin = 3;
    const numberWidth = 32;
    
    ctx.save();
    let posX = options.posX;
    const { posY, height, value, textColor } = options;
    const midY = posY + height / 2;
    
    if (options.direction === -1) {
        posX = posX - arrowWidth - innerMargin - numberWidth - innerMargin - arrowWidth;
    }
    
    // 设置箭头和数字的颜色
    const displayColor = textColor || LiteGraph.WIDGET_TEXT_COLOR;
    ctx.fillStyle = displayColor;
    
    ctx.fill(new Path2D(`M ${posX} ${midY} l ${arrowWidth} ${arrowHeight / 2} l 0 -${arrowHeight} L ${posX} ${midY} z`));
    const xBoundsArrowLess = [posX, arrowWidth];
    
    posX += arrowWidth + innerMargin;
    
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(fitString(ctx, value.toFixed(2), numberWidth), posX + numberWidth / 2, midY);
    const xBoundsNumber = [posX, numberWidth];
    
    posX += numberWidth + innerMargin;
    
    ctx.fill(new Path2D(`M ${posX} ${midY - arrowHeight / 2} l ${arrowWidth} ${arrowHeight / 2} l -${arrowWidth} ${arrowHeight / 2} v -${arrowHeight} z`));
    const xBoundsArrowMore = [posX, arrowWidth];
    
    ctx.restore();
    
    return [xBoundsArrowLess, xBoundsNumber, xBoundsArrowMore];
}
function showLoraMenu(event, callback, loras) {
    new LiteGraph.ContextMenu(
        loras,
        {
            event: event,
            title: "Choose Lora",
            scale: Math.max(1, app.canvas.ds.scale),
            className: "dark",
            callback: (value) => {
                callback(value);
            }
        },
        window
    );
}

class DragStateMixin {
    initDragState() {
        this.draggingStrength = false;
        this.dragStartX = 0;
        this.dragStartValue = 0;
        this.isDragging = false;
        this.dragStartY = 0;
        this.dragOffset = 0;
        this.dragStartTime = 0;
        this.dragStartIndex = 0;
        this.potentialDrag = false;
    }
    
    calculateActualPosY(posY, node, widgetWidth) {
        let actualPosY = posY;
        
        if (this.isDragging) {
            actualPosY = posY + this.dragOffset;
        } else if (node.draggingWidget && node.draggingWidget !== this && node.draggingWidget.isDragging) {
            const loraWidgets = node.widgets.filter(w => w.name?.startsWith("lora_"));
            const dragWidget = node.draggingWidget;
            const myIndex = loraWidgets.indexOf(this);
            const dragStartIdx = dragWidget.dragStartIndex;
            
            if (myIndex >= 0 && dragStartIdx >= 0) {
                const H = LiteGraph.NODE_WIDGET_HEIGHT;
                const SPACING = 4;
                const STEP = H + SPACING;
                
                let dragTargetIndex = dragStartIdx;
                if (dragWidget.dragOffset > H / 2) {
                    dragTargetIndex = dragStartIdx + Math.floor((dragWidget.dragOffset - H / 2) / STEP) + 1;
                } else if (dragWidget.dragOffset < -H / 2) {
                    dragTargetIndex = dragStartIdx + Math.ceil((dragWidget.dragOffset + H / 2) / STEP) - 1;
                }
                dragTargetIndex = Math.max(0, Math.min(loraWidgets.length - 1, dragTargetIndex));
                
                if (dragTargetIndex !== dragStartIdx) {
                    if (dragStartIdx < dragTargetIndex) {
                        if (myIndex > dragStartIdx && myIndex <= dragTargetIndex) {
                            actualPosY = posY - STEP;
                        }
                    } else if (dragStartIdx > dragTargetIndex) {
                        if (myIndex >= dragTargetIndex && myIndex < dragStartIdx) {
                            actualPosY = posY + STEP;
                        }
                    }
                }
            }
        }
        
        return actualPosY;
    }
    
    checkDragStart(event, node) {
        if (this.potentialDrag && !this.isDragging) {
            const deltaY = Math.abs(event.canvasY - this.dragStartY);
            const deltaTime = Date.now() - this.dragStartTime;
            if (deltaY > 5 || deltaTime > 200) {
                const loraWidgets = node.widgets.filter(w => w.name?.startsWith("lora_"));
                this.dragStartIndex = loraWidgets.indexOf(this);
                this.isDragging = true;
                this.potentialDrag = false;
                this.dragOffset = 0;
                app.canvas.canvas.style.cursor = "grabbing";
                node.draggingWidget = this;
                node.setDirtyCanvas(true, true);
                return true;
            }
        }
        return false;
    }
    
    handleDragEnd(node) {
        const loraWidgets = node.widgets.filter(w => w.name?.startsWith("lora_"));
        const H = LiteGraph.NODE_WIDGET_HEIGHT;
        const SPACING = 4;
        const STEP = H + SPACING;
        
        let targetIndex = this.dragStartIndex;
        if (this.dragOffset > STEP / 2) {
            targetIndex = this.dragStartIndex + Math.floor((this.dragOffset - STEP / 2) / STEP) + 1;
        } else if (this.dragOffset < -STEP / 2) {
            targetIndex = this.dragStartIndex + Math.ceil((this.dragOffset + STEP / 2) / STEP) - 1;
        }
        targetIndex = Math.max(0, Math.min(loraWidgets.length - 1, targetIndex));
        
        if (targetIndex !== this.dragStartIndex) {
            const controlIndex = node.widgets.findIndex(w => w.name === "control_row");
            const myIndex = node.widgets.indexOf(this);
            node.widgets.splice(myIndex, 1);
            const insertPosition = controlIndex >= 0 ? controlIndex + 1 + targetIndex : targetIndex;
            node.widgets.splice(insertPosition, 0, this);
        }
        
        this.isDragging = false;
        this.potentialDrag = false;
        this.dragOffset = 0;
        app.canvas.canvas.style.cursor = "default";
        node.draggingWidget = null;
        node.setDirtyCanvas(true, true);
    }
}

// ===== 统一 LoRA Widget（支持单/双强度切换）=====

class LoraWidget {
    constructor(name, dualMode = false) {
        this.name = name;
        this.type = "custom";
        this.dualMode = dualMode;
        this.value = { on: true, lora: "None", strength: 1.0, strengthTwo: 1.0 };
        this.options = { serialize: true };
        this.y = 0;
        this.last_y = 0;
        
        DragStateMixin.prototype.initDragState.call(this);
        this.draggingStrengthTwo = false;
        this.hitAreas = {
            toggle: { bounds: [0, 0] },
            lora: { bounds: [0, 0] },
            strengthDec: { bounds: [0, 0] },
            strengthVal: { bounds: [0, 0] },
            strengthInc: { bounds: [0, 0] },
            strengthTwoDec: { bounds: [0, 0] },
            strengthTwoVal: { bounds: [0, 0] },
            strengthTwoInc: { bounds: [0, 0] }
        };
    }
    
    computeSize(width) {
        return [width, LiteGraph.NODE_WIDGET_HEIGHT];
    }
    
    draw(ctx, node, widgetWidth, posY, widgetHeight) {
        const H = widgetHeight;
        const margin = 10;
        const innerMargin = margin * 0.33;
        const lowQuality = isLowQuality();
        
        // 计算实际绘制位置（考虑拖拽）
        const actualPosY = DragStateMixin.prototype.calculateActualPosY.call(
            this, posY, node, widgetWidth
        );
        
        // ⚠️ 重要：设置 last_y 为实际绘制的位置，而不是输入的 posY
        // 这样 mouse 事件中的 localY 计算才能正确匹配实际绘制的位置
        this.last_y = actualPosY;
        const midY = actualPosY + H * 0.5;
        let posX = margin;
        
        ctx.save();
        
        // 绘制背景
        const bgOptions = {
            pos: [posX, actualPosY],
            size: [node.size[0] - margin * 2, H],
            borderRadius: H * 0.5
        };
        
        if (this.isDragging) {
            bgOptions.colorStroke = "#4a9eff";
            bgOptions.colorBackground = "rgba(74, 158, 255, 0.2)";
            ctx.shadowColor = "rgba(74, 158, 255, 0.5)";
            ctx.shadowBlur = 10;
        }
        
        drawRoundedRectangle(ctx, bgOptions);
        
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        
        if (lowQuality) {
            ctx.restore();
            return;
        }
        
        ctx.restore();
        ctx.save();
        
        this.hitAreas.toggle.bounds = drawTogglePart(ctx, {
            posX,
            posY: actualPosY,
            height: H,
            value: this.value.on
        });
        posX += this.hitAreas.toggle.bounds[1] + innerMargin;
        
        if (!this.value.on) {
            ctx.globalAlpha = app.canvas.editor_alpha * 0.4;
        }
        
        ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
        
        let rposX = node.size[0] - margin - innerMargin - innerMargin;
        
        if (this.dualMode || node.dualStrengthMode) {
            const strengthTwoValue = this.value.strengthTwo ?? 1;
            const [leftArrow2, text2, rightArrow2] = drawNumberWidgetPart(ctx, {
                posX: rposX,
                posY: actualPosY,
                height: H,
                value: strengthTwoValue,
                direction: -1,
                textColor: getColorFromPalette("CLIP")
            });
            
            this.hitAreas.strengthTwoDec.bounds = leftArrow2;
            this.hitAreas.strengthTwoVal.bounds = text2;
            this.hitAreas.strengthTwoInc.bounds = rightArrow2;
            
            rposX = leftArrow2[0] - innerMargin * 2;
        }
        
        const strengthValue = this.value.strength ?? 1;
        const [leftArrow, text, rightArrow] = drawNumberWidgetPart(ctx, {
            posX: rposX,
            posY: actualPosY,
            height: H,
            value: strengthValue,
            direction: -1,
            textColor: this.dualMode || node.dualStrengthMode ? getColorFromPalette("MODEL") : undefined
        });
        
        this.hitAreas.strengthDec.bounds = leftArrow;
        this.hitAreas.strengthVal.bounds = text;
        this.hitAreas.strengthInc.bounds = rightArrow;
        
        rposX = leftArrow[0] - innerMargin;
        
        const loraWidth = rposX - posX;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const loraLabel = String(this.value?.lora || "None");
        ctx.fillText(fitString(ctx, loraLabel, loraWidth), posX, midY);
        this.hitAreas.lora.bounds = [posX, loraWidth];
        
        ctx.globalAlpha = app.canvas.editor_alpha;
        ctx.restore();
    }
    
    mouse(event, pos, node) {
        const localY = pos[1] - this.last_y;
        const H = LiteGraph.NODE_WIDGET_HEIGHT;
        
        if (!this.draggingStrength && !this.draggingStrengthTwo && !this.isDragging && (localY < 0 || localY > H)) {
            return false;
        }
        
        if (event.type === "pointerdown") {
            if (event.button !== 0) {
                return false;
            }
            
            const toggleHit = this.hitAreas.toggle.bounds;
            if (pos[0] >= toggleHit[0] && pos[0] <= toggleHit[0] + toggleHit[1]) {
                this.value.on = !this.value.on;
                node.setDirtyCanvas(true, true);
                return true;
            }
            
            const decHit = this.hitAreas.strengthDec.bounds;
            if (pos[0] >= decHit[0] - 6 && pos[0] <= decHit[0] + decHit[1] + 6) {
                this.value.strength = Math.max(-10.0, Math.round((this.value.strength - 0.05) * 100) / 100);
                if (!(this.dualMode || node.dualStrengthMode)) {
                    this.value.strengthTwo = this.value.strength;
                }
                node.setDirtyCanvas(true, true);
                return true;
            }
            
            const incHit = this.hitAreas.strengthInc.bounds;
            if (pos[0] >= incHit[0] - 6 && pos[0] <= incHit[0] + incHit[1] + 6) {
                this.value.strength = Math.min(10.0, Math.round((this.value.strength + 0.05) * 100) / 100);
                if (!(this.dualMode || node.dualStrengthMode)) {
                    this.value.strengthTwo = this.value.strength;
                }
                node.setDirtyCanvas(true, true);
                return true;
            }
            
            const valHit = this.hitAreas.strengthVal.bounds;
            if (pos[0] >= valHit[0] && pos[0] <= valHit[0] + valHit[1]) {
                this.draggingStrength = true;
                this.dragStartX = event.canvasX;
                this.dragStartValue = this.value.strength;
                app.canvas.canvas.style.cursor = "ew-resize";
                return true;
            }
            
            if (this.dualMode || node.dualStrengthMode) {
                const dec2Hit = this.hitAreas.strengthTwoDec.bounds;
                if (pos[0] >= dec2Hit[0] - 6 && pos[0] <= dec2Hit[0] + dec2Hit[1] + 6) {
                    this.value.strengthTwo = Math.max(-10.0, Math.round((this.value.strengthTwo - 0.05) * 100) / 100);
                    node.setDirtyCanvas(true, true);
                    return true;
                }
                
                const inc2Hit = this.hitAreas.strengthTwoInc.bounds;
                if (pos[0] >= inc2Hit[0] - 6 && pos[0] <= inc2Hit[0] + inc2Hit[1] + 6) {
                    this.value.strengthTwo = Math.min(10.0, Math.round((this.value.strengthTwo + 0.05) * 100) / 100);
                    node.setDirtyCanvas(true, true);
                    return true;
                }
                
                const val2Hit = this.hitAreas.strengthTwoVal.bounds;
                if (pos[0] >= val2Hit[0] && pos[0] <= val2Hit[0] + val2Hit[1]) {
                    this.draggingStrengthTwo = true;
                    this.dragStartX = event.canvasX;
                    this.dragStartValue = this.value.strengthTwo;
                    app.canvas.canvas.style.cursor = "ew-resize";
                    return true;
                }
            }
            
            const loraHit = this.hitAreas.lora.bounds;
            if (pos[0] >= loraHit[0] && pos[0] <= loraHit[0] + loraHit[1]) {
                this.dragStartY = event.canvasY;
                this.dragStartTime = Date.now();
                this.potentialDrag = true;
                return true;
            }
        }
        
        if (event.type === "pointermove") {
            if (DragStateMixin.prototype.checkDragStart.call(this, event, node)) {
                return true;
            }
            
            if (this.isDragging) {
                const rawOffset = event.canvasY - this.dragStartY;
                this.dragOffset = rawOffset;
                
                node.setDirtyCanvas(true, true);
                return true;
            }
            
            if (this.draggingStrength) {
                const deltaX = event.canvasX - this.dragStartX;
                const delta = deltaX / 100;
                let newStrength = this.dragStartValue + delta;
                newStrength = Math.max(-10.0, Math.min(10.0, newStrength));
                this.value.strength = Math.round(newStrength * 100) / 100;
                if (!(this.dualMode || node.dualStrengthMode)) {
                    this.value.strengthTwo = this.value.strength;
                }
                node.setDirtyCanvas(true, true);
                return true;
            }
            
            if (this.draggingStrengthTwo) {
                const deltaX = event.canvasX - this.dragStartX;
                const delta = deltaX / 100;
                let newStrength = this.dragStartValue + delta;
                newStrength = Math.max(-10.0, Math.min(10.0, newStrength));
                this.value.strengthTwo = Math.round(newStrength * 100) / 100;
                node.setDirtyCanvas(true, true);
                return true;
            }
        }
        
        if (event.type === "pointerup") {
            if (this.isDragging) {
                DragStateMixin.prototype.handleDragEnd.call(this, node);
                return true;
            }
            
            if (this.potentialDrag) {
                this.potentialDrag = false;
                const loraHit = this.hitAreas.lora.bounds;
                if (pos[0] >= loraHit[0] && pos[0] <= loraHit[0] + loraHit[1]) {
                    getLoraList().then(loras => {
                        showLoraMenu(event, (value) => {
                            if (value && value !== "None") {
                                this.value.lora = value;
                                node.setDirtyCanvas(true, true);
                            }
                        }, ["None", ...loras]);
                    });
                }
                return true;
            }
            
            if (this.draggingStrength) {
                this.draggingStrength = false;
                app.canvas.canvas.style.cursor = "default";
                
                const deltaX = Math.abs(event.canvasX - this.dragStartX);
                if (deltaX < 5) {
                    const isHelpText = node.dualStrengthMode ? "Model Strength" : "Strength";
                    app.canvas.prompt(
                        isHelpText,
                        this.value.strength,
                        (v) => {
                            const num = parseFloat(v);
                            if (!isNaN(num)) {
                                this.value.strength = parseFloat(Math.max(-10.0, Math.min(10.0, num)).toFixed(2));
                                // 单行模式：同步model和clip强度
                                if (!(this.dualMode || node.dualStrengthMode)) {
                                    this.value.strengthTwo = this.value.strength;
                                }
                                node.setDirtyCanvas(true, true);
                            }
                        },
                        event
                    );
                }
                return true;
            }
            
            if (this.draggingStrengthTwo) {
                this.draggingStrengthTwo = false;
                app.canvas.canvas.style.cursor = "default";
                
                const deltaX = Math.abs(event.canvasX - this.dragStartX);
                if (deltaX < 5) {
                    app.canvas.prompt(
                        "Clip Strength",
                        this.value.strengthTwo,
                        (v) => {
                            const num = parseFloat(v);
                            if (!isNaN(num)) {
                                this.value.strengthTwo = parseFloat(Math.max(-10.0, Math.min(10.0, num)).toFixed(2));
                                // 单行模式：同步model强度
                                if (!(this.dualMode || node.dualStrengthMode)) {
                                    this.value.strength = this.value.strengthTwo;
                                }
                                node.setDirtyCanvas(true, true);
                            }
                        },
                        event
                    );
                }
                return true;
            }
        }
        
        return false;
    }
    
    serializeValue(node, index) {
        const strength = parseFloat(this.value.strength);
        const strengthTwo = parseFloat(this.value.strengthTwo);
        return {
            ...this.value,
            strength: Number(strength.toFixed(2)),
            strengthTwo: Number(strengthTwo.toFixed(2))
        };
    }
}

class ControlRowWidget {
    constructor(name = "control_row") {
        this.name = name;
        this.type = "custom";
        this.value = { type: "ControlRowWidget" };
        this.options = {};
        this.y = 0;
        this.last_y = 0;
        
        this.hitAreas = {
            toggleAll: { bounds: [0, 0] },
            addLora: { bounds: [0, 0] },
            modeSwitch: { bounds: [0, 0] }
        };
    }
    
    draw(ctx, node, width, posY) {
        const H = LiteGraph.NODE_WIDGET_HEIGHT;
        const margin = 10;
        const innerMargin = 3;
        const lowQuality = isLowQuality();
        
        this.last_y = posY;
        const midY = posY + H / 2;
        let posX = margin;
        
        ctx.save();
        
        const loraWidgets = node.widgets.filter(w => w.name?.startsWith("lora_"));
        const allOn = loraWidgets.every(w => w.value?.on);
        const anyOn = loraWidgets.some(w => w.value?.on);
        const toggleState = allOn ? true : (anyOn ? null : false);
        
        // 左侧：Toggle All 开关
        this.hitAreas.toggleAll.bounds = drawTogglePart(ctx, {
            posX,
            posY,
            height: H,
            value: toggleState
        });
        posX += this.hitAreas.toggleAll.bounds[1] + innerMargin;
        
        if (!lowQuality) {
            ctx.globalAlpha = app.canvas.editor_alpha * 0.6;
            ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.font = "12px Arial";
            ctx.fillText("Toggle All", posX, midY);
        }
        
        const modeSwitchText = node.dualStrengthMode ? "Model/Clip" : "Strength";
        ctx.font = "12px Arial";
        const modeSwitchWidth = ctx.measureText(modeSwitchText).width + 16;
        const modeSwitchHeight = H - 6;
        const modeSwitchX = node.size[0] - margin - modeSwitchWidth;
        const modeSwitchY = posY + 3;
        
        this.hitAreas.modeSwitch.bounds = [modeSwitchX, modeSwitchWidth];
        
        if (!lowQuality) {
            ctx.beginPath();
            ctx.roundRect(modeSwitchX, modeSwitchY, modeSwitchWidth, modeSwitchHeight, [modeSwitchHeight * 0.5]);
            ctx.fillStyle = node.dualStrengthMode ? "#4a9eff" : LiteGraph.WIDGET_BGCOLOR;
            ctx.fill();
            ctx.strokeStyle = LiteGraph.WIDGET_OUTLINE_COLOR;
            ctx.stroke();
            
            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.fillText(modeSwitchText, modeSwitchX + modeSwitchWidth / 2, midY);
        }
        
        const buttonText = "Add Lora";
        ctx.font = "13px Arial";
        const buttonWidth = ctx.measureText(buttonText).width + 20;
        const buttonHeight = H - 6;
        const buttonX = (node.size[0] - buttonWidth) / 2;  // 居中
        const buttonY = posY + 3;
        
        this.hitAreas.addLora.bounds = [buttonX, buttonWidth];
        
        if (!lowQuality) {
            ctx.beginPath();
            ctx.roundRect(buttonX, buttonY, buttonWidth, buttonHeight, [buttonHeight * 0.5]);
            ctx.fillStyle = LiteGraph.WIDGET_BGCOLOR;
            ctx.fill();
            ctx.strokeStyle = LiteGraph.WIDGET_OUTLINE_COLOR;
            ctx.stroke();
            
            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.fillText(buttonText, buttonX + buttonWidth / 2, midY);
        }
        
        ctx.restore();
    }
    
    mouse(event, pos, node) {
        const localY = pos[1] - this.last_y;
        const H = LiteGraph.NODE_WIDGET_HEIGHT;
        
        if (localY < 0 || localY > H) {
            return false;
        }
        
        if (event.type === "pointerdown") {
            // Toggle All 开关
            const toggleHit = this.hitAreas.toggleAll.bounds;
            if (pos[0] >= toggleHit[0] && pos[0] <= toggleHit[0] + toggleHit[1]) {
                const loraWidgets = node.widgets.filter(w => w.name?.startsWith("lora_"));
                const allOn = loraWidgets.every(w => w.value?.on);
                const newState = !allOn;
                
                loraWidgets.forEach(w => {
                    if (w.value) {
                        w.value.on = newState;
                    }
                });
                
                node.setDirtyCanvas(true, true);
                return true;
            }
            
            const modeHit = this.hitAreas.modeSwitch.bounds;
            if (pos[0] >= modeHit[0] && pos[0] <= modeHit[0] + modeHit[1]) {
                const wasDualMode = node.dualStrengthMode;
                node.dualStrengthMode = !node.dualStrengthMode;
                
                const loraWidgets = node.widgets.filter(w => w.name?.startsWith("lora_"));
                loraWidgets.forEach(w => {
                    if (w.dualMode !== undefined) {
                        w.dualMode = node.dualStrengthMode;
                        
                        // 从单行切换到双行：复制单行强度到model和clip
                        if (wasDualMode === false && node.dualStrengthMode === true) {
                            w.value.strengthTwo = w.value.strength;
                        }
                        // 从双行切换到单行：复制model强度到单行
                        else if (wasDualMode === true && node.dualStrengthMode === false) {
                            w.value.strength = w.value.strengthTwo;
                        }
                    }
                });
                
                node.setDirtyCanvas(true, true);
                return true;
            }
            
            
            const addHit = this.hitAreas.addLora.bounds;
            if (pos[0] >= addHit[0] && pos[0] <= addHit[0] + addHit[1]) {
                getLoraList().then(loras => {
                    showLoraMenu(event, (loraName) => {
                        if (loraName && loraName !== "None") {
                            node.addLoraWidget(loraName);
                        }
                    }, ["None", ...loras]);
                });
                return true;
            }
        }
        
        return false;
    }
    
    serializeValue(node, index) {
        return this.value;
    }
}

function registerPowerLoraNode(nodeData, defaultDualMode = false) {
    const nodeName = nodeData.name;
    
    return {
        name: `PowerLora.${nodeName}`,
        
        async beforeRegisterNodeDef(nodeType, nodeData, app) {
            if (nodeData.name === nodeName) {
                const onNodeCreated = nodeType.prototype.onNodeCreated;
                nodeType.prototype.onNodeCreated = function() {
                    const result = onNodeCreated?.apply(this, arguments);
                    
                    this.serialize_widgets = true;
                    this.loraWidgetCounter = 0;
                    this.dualStrengthMode = defaultDualMode;
                    preloadLoraList();
                    const controlWidget = new ControlRowWidget("control_row");
                    this.addCustomWidget(controlWidget);
                    
                    return result;
                };
                
                nodeType.prototype.addLoraWidget = function(loraName = "None") {
                    const loraWidgets = this.widgets.filter(w => w.name?.startsWith("lora_"));
                    if (loraWidgets.length >= 100) {
                        alert("已达到最大 LoRA 数量限制（100 个）！");
                        return null;
                    }
                    
                    this.loraWidgetCounter = (this.loraWidgetCounter || 0) + 1;
                    const widget = new LoraWidget(`lora_${this.loraWidgetCounter}`, this.dualStrengthMode);
                    widget.value = { on: true, lora: loraName, strength: 1.0, strengthTwo: 1.0 };
                    
                    widget.options = widget.options || {};
                    widget.options.serialize = true;
                    
                    this.addCustomWidget(widget);
                    
                    const inputIndex = this.inputs?.findIndex(i => i.name === widget.name);
                    if (inputIndex >= 0) {
                        this.removeInput(inputIndex);
                    }
                    
                    const computed = this.computeSize();
                    this.size[1] = Math.max(this.size[1], computed[1]);
                    this.setDirtyCanvas(true, true);
                    
                    return widget;
                };
                
                const originalGetSlotInPosition = nodeType.prototype.getSlotInPosition;
                nodeType.prototype.getSlotInPosition = function(canvasX, canvasY) {
                    const slot = originalGetSlotInPosition?.apply(this, arguments);
                    
                    if (slot) {
                        return slot;
                    }
                    
                    if (this.widgets) {
                        const H = LiteGraph.NODE_WIDGET_HEIGHT;
                        for (const widget of this.widgets) {
                            if (!widget.last_y) continue;
                            const widgetStartY = this.pos[1] + widget.last_y;
                            const widgetEndY = widgetStartY + H;
                            if (canvasY >= widgetStartY && canvasY < widgetEndY) {
                                if (widget.name?.startsWith("lora_")) {
                                    return { widget: widget, output: { type: "LORA_WIDGET" } };
                                }
                                return null;
                            }
                        }
                    }
                    
                    return null;
                };
                
                nodeType.prototype.getSlotMenuOptions = function(slot) {
                    if (slot?.widget?.name?.startsWith("lora_")) {
                        const widget = slot.widget;
                        const index = this.widgets.indexOf(widget);
                        
                        const menuItems = [
                            {
                                content: `ℹ️ 显示信息`,
                                callback: () => {
                                    if (widget.value.lora && widget.value.lora !== "None") {
                                        showLoraInfoDialog(widget.value.lora);
                                    }
                                }
                            },
                            null,
                            {
                                content: `${widget.value.on ? "⚫ 关闭此 Lora" : "🟢 开启此 Lora"}`,
                                callback: () => {
                                    widget.value.on = !widget.value.on;
                                    this.setDirtyCanvas(true, true);
                                }
                            },
                            {
                                content: "🗑️ 删除此 Lora",
                                callback: () => {
                                    this.widgets.splice(index, 1);
                                    const computed = this.computeSize();
                                    this.size[1] = Math.max(this.size[1], computed[1]);
                                    this.setDirtyCanvas(true, true);
                                }
                            }
                        ];

                        // Return the menu items to let the front-end (LGraphCanvas) display the menu.
                        return menuItems;
                    }
                    
                    // Build a default slot menu similar to LGraphCanvas when a node
                    // does not implement getSlotMenuOptions. This ensures outputs/inputs
                    // that are not widget-related still show the standard menus.
                    const fallbackMenu = [];
                    if (slot?.output?.links?.length) {
                        fallbackMenu.push({ content: 'Disconnect Links', slot });
                    }

                    const _slot = slot.input || slot.output;
                    if (!_slot) {
                        throw new TypeError('Both input and output slots were null when building fallback menu.');
                    }

                    if (!_slot.nameLocked && !('link' in _slot && _slot.widget)) {
                        fallbackMenu.push({ content: 'Rename Slot', slot });
                    }

                    if (_slot.removable) {
                        fallbackMenu.push(null);
                        fallbackMenu.push(_slot.locked ? { content: 'Cannot remove' } : { content: 'Remove Slot', slot, className: 'danger' });
                    }

                    if (this.getExtraSlotMenuOptions) {
                        try {
                            const extra = this.getExtraSlotMenuOptions(slot);
                            if (Array.isArray(extra) && extra.length) fallbackMenu.push(...extra);
                        } catch (e) {
                            console.warn('getExtraSlotMenuOptions threw', e);
                        }
                    }

                    return fallbackMenu;
                };
                
                const originalConfigure = nodeType.prototype.configure;
                nodeType.prototype.configure = function(info) {
                    while (this.widgets?.length) {
                        this.widgets.pop();
                    }
                    
                    if (originalConfigure) {
                        originalConfigure.call(this, info);
                    }
                    
                    this.dualStrengthMode = info.dualStrengthMode !== undefined ? info.dualStrengthMode : defaultDualMode;
                    
                    const controlWidget = new ControlRowWidget("control_row");
                    this.addCustomWidget(controlWidget);
                    
                    this.loraWidgetCounter = 0;
                    if (info.widgets_values) {
                        for (const value of info.widgets_values) {
                            if (value && typeof value === 'object' && value.lora !== undefined) {
                                this.loraWidgetCounter++;
                                const widget = new LoraWidget(`lora_${this.loraWidgetCounter}`, this.dualStrengthMode);
                                widget.value = { ...value };
                                this.addCustomWidget(widget);
                            }
                        }
                    }
                    
                    const computed = this.computeSize();
                    this.size[0] = Math.max(this.size[0] || 0, computed[0]);
                    this.size[1] = Math.max(this.size[1] || 0, computed[1]);
                };
                
                const originalSerialize = nodeType.prototype.serialize;
                nodeType.prototype.serialize = function() {
                    const data = originalSerialize ? originalSerialize.apply(this) : {};
                    data.dualStrengthMode = this.dualStrengthMode;
                    return data;
                };
            }
        }
    };
}

app.registerExtension(registerPowerLoraNode({ name: "PowerLoraLoader" }, false));
app.registerExtension(registerPowerLoraNode({ name: "PowerLoraStacker" }, false));

// 在模块加载时预加载 LoRA 列表
preloadLoraList();
