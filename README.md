# ComfyUI Easy Setting Pipes

A collection of utility nodes for ComfyUI to streamline workflows and manage LoRAs efficiently.

## Overview

Easy Setting Pipes provides three main components:

- Sampler Setup Nodes: Streamlined configuration nodes for sampling parameters
- Power LoRA Loader: Advanced LoRA management with support for multiple models  
- Convert Any Node: Utility node for fixing compatibility issues

## Features

### Sampler Setup Nodes

A lightweight custom pipeline node that integrates key sampling parameters into a single compact node:

- Integrated Parameters: steps, cfg, clip_skip, sampler, scheduler, width, height, batch_size
- Quick Width/Height Swap: One-click toggle to swap width and height values
- Unpack Node: Deconstruct the output pipe for further processing
- Space Saving: Eliminates the need for bulky multi-output nodes

Available Nodes:
- SamplerSetup: Pack sampling parameters into a single pipe
- SamplerSetupUnpack: Unpack pipe to get individual parameters

### Power LoRA Loader & Stacker

A powerful and user-friendly LoRA management plugin with advanced features:

- Multiple LoRA Management: Load and manage up to 100 LoRAs in a single node
- Drag & Drop Reordering: Easily rearrange LoRAs by dragging
- Flexible Strength Modes: Switch between single strength and dual (Model/Clip) modes
- Visual Feedback: Color-coded strength controls and toggle states
- Batch Toggle: Enable/disable all LoRAs with a single click
- Right-Click Menu: Quick access to enable/disable or delete LoRAs

Available Nodes:

**Power LoRA Loader**
- Loads LoRAs and applies them to your model and clip
- Supports both single and dual strength modes
- Chainable with other LoRA loaders
- Inputs: model, clip, optional lora_stack
- Outputs: model, clip

**Power LoRA Stacker**
- Creates a LoRA stack for use with other nodes
- Compatible with efficiency nodes and stack-based workflows
- Supports both single and dual strength modes
- Inputs: optional lora_stack (for chaining)
- Outputs: lora_stack

### Convert Any Node

A utility node to fix compatibility issues where some sampler nodes cannot use standard sampler and scheduler inputs. This node accepts any input type and passes it through without modification.

## Screenshots

![Example1](https://github.com/user-attachments/assets/24945acb-39b2-41c0-9855-757c9cfd15f5)

![Example2](https://github.com/user-attachments/assets/0d2c8237-2747-409d-8914-ab78200cd498)

## Installation

### Method 1: ComfyUI Manager (Recommended)

1. Open ComfyUI Manager
2. Search for 'Easy Setting Pipes'
3. Click Install

### Method 2: Manual Installation

1. Navigate to your ComfyUI custom nodes folder:
   - cd ComfyUI/custom_nodes/

2. Clone this repository:
   - git clone https://github.com/yourusername/Comfyui-EasySettingPipes.git

3. Restart ComfyUI

## Usage

### Sampler Setup Usage

1. Add a SamplerSetup node to your workflow
2. Configure the sampling parameters:
   - steps: Number of sampling steps (default: 20)
   - cfg: Guidance scale (default: 7.0)
   - clip_skip: CLIP layer skip value (default: -1)
   - sampler_name: Select sampler algorithm
   - scheduler: Select noise scheduler
   - width: Image width (default: 1024)
   - height: Image height (default: 1024)
   - swap_wh: Toggle to quickly swap width and height
   - batch_size: Batch size (default: 1)

3. Connect the setup_pipe output to other nodes
4. Use SamplerSetupUnpack to extract individual parameters when needed

### Power LoRA Loader Usage

1. Add a Power LoRA Loader or Power LoRA Stacker node to your workflow
2. Click the 'Add LoRA' button to select a LoRA from your models
3. Adjust strength values by:
   - Clicking the arrow buttons (0.05)
   - Dragging the value left/right for fine control
   - Clicking the value to enter a precise number
4. Toggle individual LoRAs on/off by clicking the switch
5. Use 'Toggle All' to enable/disable all LoRAs at once

#### Strength Modes

Click the mode switch button to toggle between:

- Strength Mode: Single strength value (applied to both model and clip)
- Model/Clip Mode: Separate strength values for model and clip
  - Left value (orange): Model strength
  - Right value (cyan): Clip strength

#### Drag & Drop Reordering

1. Click and hold on a LoRA name
2. Drag up or down to reorder
3. Release to place in new position

#### Right-Click Menu

Right-click on any LoRA to:
- Toggle it on/off
- Delete it from the list

## Compatibility

- ComfyUI Version: Latest (tested with 2024+ versions)
- Python: 3.9+
- OS: Windows, Linux, macOS

## License

MIT License

## Credits

- Original concept by the ComfyUI community
- Inspired by efficient workflow design patterns
- Built with flexibility and user experience in mind
