Just a custom Pipe and settings node designed to streamline workflows. It eliminates the need for bulky multi-output nodes, saving space and reducing clutter for comfyui
A lightweight custom pipeline node that integrates key sampling parameters (steps, cfg, clip_skip, sampler, scheduler, width, height, batch_size) with a toggle for quick width/height swapping. Also includes an unpack node to deconstruct the output pipe for further processing.
Additionally, include a "Convert Any Node" utility to fix compatibility issues where some sampler nodes cannot use the standard sampler and scheduler inputs.

只是单纯的添加了一个自定义Pipe和设置节点以简洁化工作流，使用户不需要在工作流中摆出一个拥有许多输出端口的节点占用额外空间。
包含了"steps", "cfg", "clip_skip", "sampler", "scheduler", "width", "height", "batch_size" 与一键切换宽高输出的开关，以及把输出pipe解包的unpack节点。
此外，加入一个 “Convert Any Node” 工具，用于修复某些采样器节点无法使用标准采样器和调度器输入的问题。
![Example1](https://github.com/user-attachments/assets/24945acb-39b2-41c0-9855-757c9cfd15f5)
![Example2](https://github.com/user-attachments/assets/0d2c8237-2747-409d-8914-ab78200cd498)
