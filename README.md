<!--
    DevCon Documentation

    This repository contains Echo DevCon, a unified VS Code IDE extension powered by Echo Registry.
    It provides seamless integration for AlsaniaMCP, Nyx, and Echo Registry tools, enabling efficient development workflows.
    Key features include a shared registry, on-demand tool activation, auto-shutdown for resource management, and manual persistence options.
    Designed for lightweight operation on constrained machines.

    For setup and usage instructions, refer to the sections below.
-->

# DevCon

**DevCon — powered by Echo Registry**

A unified VS Code IDE extension for AlsaniaMCP, Nyx, and Echo Registry tools.

## Features

- One shared registry for all tools (port 8060).
- Tools only spin up when needed, then auto-shutdown after 10 minutes.
- Manual-only persistence for AlsaniaMCP (8050) and Nyx (3006).
- Lightweight, resource-friendly, perfect for constrained machines.

## Usage

1. Start Echo Registry:

   ```bash
   cd ~/Desktop/echo-lab/tools/echo-registry
   uvicorn registry:app --host 0.0.0.0 --port 8060
   ```

2. Launch VS Code with DevCon enabled.

<<<<<<< HEAD
<<<<<<< HEAD
3. DevCon queries Echo Registry for tools automatically.
=======
## Agent

[Agent](https://docs.continue.dev/features/agent/quick-start) to work on development tasks together with AI

![agent](docs/images/agent.gif)

## Chat

[Chat](https://docs.continue.dev/features/chat/quick-start) to ask general questions and clarify code sections

![chat](docs/images/chat.gif)

## Edit

[Edit](https://docs.continue.dev/features/edit/quick-start) to modify a code section without leaving your current file

![edit](docs/images/edit.gif)

## Autocomplete

[Autocomplete](https://docs.continue.dev/features/autocomplete/quick-start) to receive inline code suggestions as you type

![autocomplete](docs/images/autocomplete.gif)

</div>

## Contributing

Read the [contributing guide](https://github.com/continuedev/continue/blob/main/CONTRIBUTING.md), and
join [#contribute on Discord](https://discord.gg/vapESyrFmJ).

## License

[Apache 2.0 © 2023-2024 Continue Dev, Inc.](./LICENSE)
>>>>>>> upstream/sigmasauer07
=======
3. DevCon queries Echo Registry for tools automatically.
>>>>>>> 28516c7fabf170e523ba3466dde6fb413f3b0d92
# devcon
# devconx
