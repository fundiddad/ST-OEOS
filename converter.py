import json
import re
import argparse
import sys
from collections import deque

class OEOSConverter:
    """
    在 OEOS v1 (JSON) 和 OEOS v4 (OEOScript) 格式之间进行双向转换。
    """
    V4_SHORTCUT_COMMANDS = {
        'say': 'label', 'image': 'url', 'audio.play': 'url', 'goto': 'target',
        'storage.remove': 'key', 'enable': 'target', 'disable': 'target',
        'notification.remove': 'id'
    }

    def to_v4(self, v1_data: dict) -> str:
        """将 v1 JSON 数据转换为 v4 OEOScript 字符串。"""
        lines = []
        if v1_data.get('meta', {}).get('init'):
            lines.append("---")
            init_script = v1_data['meta']['init'].strip()
            indented_lines = ["  " + line for line in init_script.split('\n')]
            lines.append("init: |")
            lines.append('\n'.join(indented_lines))
            lines.append("---")

        pages = v1_data.get("pages", {})
        for page_id, commands in pages.items():
            lines.append(f"\n> {page_id}")
            lines.extend(self._commands_to_v4(commands, 1))
        return "\n".join(lines)

    def _commands_to_v4(self, commands: list, indent_level: int) -> list:
        lines = []
        indent = "  " * indent_level
        for command_obj in commands:
            cmd_name, params = list(command_obj.items())[0]

            if cmd_name == 'if':
                condition = params.get('condition', 'true')
                lines.append(f"{indent}if {condition}")
                lines.extend(self._commands_to_v4(params.get('commands', []), indent_level + 1))
                
                else_commands = params.get('elseCommands', [])
                while else_commands:
                    next_block = else_commands[0]
                    if 'if' in next_block:
                        else_params = next_block['if']
                        condition = else_params.get('condition')
                        if condition:
                            lines.append(f"{indent}else if {condition}")
                        else:
                            lines.append(f"{indent}else")
                        lines.extend(self._commands_to_v4(else_params.get('commands', []), indent_level + 1))
                        else_commands = else_params.get('elseCommands', [])
                    else:
                        lines.append(f"{indent}else")
                        lines.extend(self._commands_to_v4(else_commands, indent_level + 1))
                        break
                continue

            lines.append(f"{indent}{self._format_command_to_v4(cmd_name, params, indent_level)}")
            
            if cmd_name == 'choice':
                for opt in params.get('options', []):
                    lines.extend(self._option_to_v4(opt, indent_level + 1))
            elif cmd_name == 'notification.create':
                if 'commands' in params:
                    lines.append(f"{indent}  commands")
                    lines.extend(self._commands_to_v4(params['commands'], indent_level + 2))
                if 'timerCommands' in params:
                    lines.append(f"{indent}  timerCommands")
                    lines.extend(self._commands_to_v4(params['timerCommands'], indent_level + 2))
            elif cmd_name == 'timer' and 'commands' in params:
                 lines.extend(self._commands_to_v4(params['commands'], indent_level + 1))
        return lines
        
    def _format_command_to_v4(self, cmd_name: str, params: dict, indent_level: int) -> str:
        if cmd_name in self.V4_SHORTCUT_COMMANDS:
            param_key = self.V4_SHORTCUT_COMMANDS[cmd_name]
            if param_key in params:
                value = self._format_value_v4(params[param_key])
                other_params = {k: v for k, v in params.items() if k != param_key}
                param_str = " ".join(f"{k}: {self._format_value_v4(v)}" for k, v in other_params.items())
                return f"{cmd_name} {value}{' ' if param_str else ''}{param_str}"
        
        if cmd_name == 'eval' and '\n' in params.get('action', ''):
             code_lines = params['action'].strip().split('\n')
             indented_code = '\n'.join(['  ' * (indent_level + 1) + line.strip() for line in code_lines])
             return f"eval\n{indented_code}"
        elif cmd_name == 'eval':
             return f"eval code: {self._format_value_v4(params.get('action', ''))}"
             
        param_str = " ".join(f"{k}: {self._format_value_v4(v)}" for k, v in params.items() if k not in ['commands', 'options', 'timerCommands', 'elseCommands'])
        return f"{cmd_name}{' ' if param_str else ''}{param_str}"

    def _option_to_v4(self, option: dict, indent_level: int) -> list:
        indent = "  " * indent_level
        label = self._format_value_v4(option.get('label', ''))
        args = []
        if option.get('visible') is not True and option.get('visible') is not None:
             args.append(f"when: {option['visible']}")
        if 'color' in option:
            args.append(f"color: {self._format_value_v4(option['color'])}")
        if option.get('keep'):
            args.append(f"keep: true")
        header = f"{indent}{label}{' ' if args else ''}{' '.join(args)}"
        commands = option.get('commands', [])
        if len(commands) == 1 and list(commands[0].keys())[0] in ['goto', 'end']:
            cmd_name, params = list(commands[0].items())[0]
            if cmd_name == 'end': return [f"{header} -> end"]
            return [f"{header} -> goto {params.get('target')}"]
        lines = [header]
        lines.extend(self._commands_to_v4(commands, indent_level + 1))
        return lines

    def _format_value_v4(self, value) -> str:
        if isinstance(value, str):
            if value.startswith('$'): return value
            return json.dumps(value, ensure_ascii=False)
        if isinstance(value, bool): return "true" if value else "false"
        if isinstance(value, (int, float)): return str(value)
        return "null"

    def to_v1(self, v4_script: str) -> dict:
        """将 v4 OEOScript 字符串解析为 v1 JSON 数据。"""
        lines = v4_script.split('\n')
        v1_data = {"pages": {}}
        
        if lines and lines[0].strip() == '---':
            try:
                end_meta_index = lines.index('---', 1)
                meta_lines = lines[1:end_meta_index]
                lines = lines[end_meta_index + 1:]
                for i, line in enumerate(meta_lines):
                    if line.strip().startswith('init:'):
                        init_script = '\n'.join(l.strip() for l in meta_lines[i + 1:])
                        v1_data['meta'] = {'init': init_script}
                        break
            except ValueError:
                raise ValueError("元数据块 '---' 未正确闭合")

        context_stack = deque()
        for line_num, line in enumerate(lines, 1):
            if not line.strip() or (line.strip().startswith('#') and not line.startswith('#')):
                continue
            indent_size = len(line) - len(line.lstrip(' '))
            line_content = line.strip()

            while context_stack and indent_size <= context_stack[-1][1]:
                context_stack.pop()
            
            if line_content.startswith(('>', '#')) and indent_size == 0:
                page_id = line_content[1:].strip()
                page_commands = []
                v1_data["pages"][page_id] = page_commands
                context_stack.clear()
                context_stack.append((page_commands, -1))
                continue

            if not context_stack:
                 if line_content: raise ValueError(f"第 {line_num} 行: 在页面声明之外找到命令 '{line_content}'")
                 continue
            
            parent_list, parent_indent = context_stack[-1]

            try:
                command_obj, block_info = self._parse_v4_line(line_content)
                cmd_name = list(command_obj.keys())[0]

                if cmd_name == 'if':
                    is_else = block_info.get('is_else', False)
                    if is_else:
                        if not parent_list or 'if' not in parent_list[-1]:
                            raise ValueError(f"第 {line_num} 行: 'else' 或 'else if' 没有匹配的 'if'")

                        # last_if_struct is the dict like {'if': {...}}
                        last_if_struct = parent_list[-1]

                        # Traverse the chain of else ifs
                        while 'elseCommands' in last_if_struct['if']:
                            else_cmds = last_if_struct['if']['elseCommands']
                            if not else_cmds: # empty else, can attach here
                                break

                            # The next link in the chain must be another 'if' statement.
                            next_if_struct = else_cmds[0]
                            if 'if' not in next_if_struct:
                                # This is a terminal `else` block with actions, not another `else if`.
                                raise ValueError(f"第 {line_num} 行: 在一个最终 'else' 块之后不允许 'else'/'else if'")

                            last_if_struct = next_if_struct

                        # Attach the new command to the last 'if' in the chain.
                        if not command_obj.get('if', {}).get('condition'): # This is a pure 'else'
                             last_if_struct['if']['elseCommands'] = command_obj['if']['commands']
                        else: # This is an 'else if'
                             last_if_struct['if']['elseCommands'] = [command_obj]
                    else:
                        parent_list.append(command_obj)
                else:
                    parent_list.append(command_obj)

                if block_info.get('new_block'):
                    new_list = command_obj[cmd_name]['commands']
                    context_stack.append((new_list, indent_size))
                elif block_info.get('new_options_block'):
                    context_stack.append((command_obj[cmd_name]['options'], indent_size))
                elif block_info.get('new_notif_block'):
                     context_stack.append((command_obj[cmd_name], indent_size))
                elif block_info.get('is_multiline_eval'):
                    context_stack.append((command_obj[cmd_name], indent_size))

            except Exception as e:
                raise ValueError(f"解析第 {line_num} 行时出错: '{line_content}' -> {e}")

        def cleanup(obj):
            if isinstance(obj, dict):
                for k, v in list(obj.items()):
                    if isinstance(v, dict):
                        if 'commands' in v and not v['commands'] and k == 'timer':
                            del v['commands']
                        cleanup(v)
                    elif isinstance(v, list):
                        cleanup(v)
                    elif k == 'action' and isinstance(v, str):
                        obj[k] = v.strip()
            elif isinstance(obj, list):
                for item in obj:
                    cleanup(item)
        cleanup(v1_data)
        return v1_data
        
    def _parse_v4_line(self, line: str) -> (dict, dict):
        # This is now a simplified line parser
        parts = line.split(' ', 1)
        cmd_name = parts[0]
        args_str = parts[1] if len(parts) > 1 else ''
        params, block_info = {}, {}

        # Handle options separately as they are not standard commands
        if line.startswith('"'):
             return self._parse_v4_option(line)
        
        # Handle notification sub-blocks
        if cmd_name in ['commands', 'timerCommands']:
             return {cmd_name: {}}, {'sub_block': True}

        # 检查是否使用了命名参数语法（例如 "say label: ..."）
        # 如果第一个参数是命名参数的键（以冒号结尾），则不应该使用快捷参数语法
        param_key = self.V4_SHORTCUT_COMMANDS.get(cmd_name)
        is_named_param_syntax = param_key and args_str.lstrip().startswith(param_key + ':')

        if cmd_name in self.V4_SHORTCUT_COMMANDS and not is_named_param_syntax:
            # More robustly handle quoted strings and the rest of the arguments
            match = re.match(r'(".*?"|\S+)\s*(.*)', args_str)
            if match:
                value, remaining_args = match.groups()
                # The shortcut param name is the same as the command name for timer.remove
                params[param_key] = self._parse_value_v1(value)
                args_str = remaining_args
        named_args = re.findall(r'(\w+):\s*(".*?"|true|false|-?\d+\.?\d*|\$\S+)', args_str)
        for key, value in named_args:
            params[key] = self._parse_value_v1(value)

        if cmd_name == 'if' or (cmd_name == 'else' and 'if' in args_str):
            params = {'condition': args_str.replace('if', '').strip(), 'commands': []}
            block_info['new_block'] = True
            if cmd_name == 'else': block_info['is_else'] = True
            cmd_name = 'if'
        elif cmd_name == 'else':
            params = {'commands': []}
            block_info['new_block'] = True
            block_info['is_else'] = True
            cmd_name = 'if'
        elif cmd_name == 'choice':
            params['options'] = []
            block_info['new_options_block'] = True
        elif cmd_name == 'notification.create':
            block_info['new_notif_block'] = True
        elif cmd_name == 'timer':
            params['commands'] = []
            block_info['new_block'] = True
        elif cmd_name == 'eval' and 'code' not in params:
            params['action'] = ""
            block_info['is_multiline_eval'] = True
        elif cmd_name == 'eval' and 'code' in params:
            params['action'] = params.pop('code')
        
        return {cmd_name: params}, block_info

    def _parse_v4_option(self, line: str) -> (dict, dict):
        commands, block_info = [], {}
        if '->' in line:
            parts = line.split('->', 1)
            line = parts[0].strip()
            cmd_parts = parts[1].strip().split(' ', 1)
            if cmd_parts[0] == 'end': commands.append({'end': {}})
            elif cmd_parts[0] == 'goto': commands.append({'goto': {'target': self._parse_value_v1(cmd_parts[1])}})
            else: raise ValueError(f"-> 快捷方式只支持 'end' 和 'goto', 但得到 '{cmd_parts[0]}'")
        else:
            block_info['new_block'] = True

        match = re.match(r'(".*?")\s*(.*)', line)
        if not match: raise ValueError(f"无法解析 option 行: {line}")
        label_str, args_str = match.groups()
        option = {'label': self._parse_value_v1(label_str), 'commands': commands}
        
        named_args = re.findall(r'(when|color|keep):\s*(".*?"|true|false|-?\d+\.?\d*|\$\S+)', args_str)
        for key, value in named_args:
            if key == 'when': option['visible'] = value
            else: option[key] = self._parse_value_v1(value)
        return option, block_info
        
    def _parse_value_v1(self, value_str: str):
        value_str = value_str.strip()
        if value_str.startswith('"') and value_str.endswith('"'): return json.loads(value_str)
        if value_str == 'true': return True
        if value_str == 'false': return False
        if value_str.startswith('$'): return value_str
        try: return int(value_str)
        except ValueError:
            try: return float(value_str)
            except ValueError: return value_str

    def to_v1_main_loop(self, lines: list, v1_data: dict):
        """主解析循环"""
        # (list_to_append_to, indent_level, context_name)
        context_stack = deque()
        for line_num, line in enumerate(lines, 1):
            if not line.strip() or (line.strip().startswith('#') and not line.startswith('#')): continue

            indent_size = len(line) - len(line.lstrip(' '))
            line_content = line.strip()

            while context_stack and indent_size <= context_stack[-1][1]:
                context_stack.pop()
            
            if line_content.startswith(('>', '#')) and indent_size == 0:
                page_id = line_content[1:].strip()
                page_commands = []
                v1_data["pages"][page_id] = page_commands
                context_stack.clear()
                context_stack.append((page_commands, -1, 'page'))
                continue

            if not context_stack:
                if line_content: raise ValueError(f"第 {line_num} 行: 在页面声明之外找到命令 '{line_content}'")
                continue
            
            parent_list, parent_indent, parent_context_name = context_stack[-1]

            try:
                # Special handling for notification.create sub-blocks
                if parent_context_name == 'notification.create':
                    if line_content in ['commands', 'timerCommands']:
                        # The parent_list IS the notification dict in this case
                        new_list = []
                        parent_list[line_content] = new_list
                        context_stack.append((new_list, indent_size, 'commands'))
                        continue
                    else: # A command inside notification's commands/timerCommands list
                        pass # Fall through to normal command parsing

                # Special handling for choice blocks (only accept options)
                if parent_context_name == 'choice':
                    option_obj, block_info = self._parse_v4_option(line_content)
                    parent_list.append(option_obj)
                    if block_info.get('new_block'):
                        context_stack.append((option_obj['commands'], indent_size, 'commands'))
                    continue

                # Handle multiline eval
                if parent_context_name == 'eval':
                    parent_list['action'] += line_content + '\n' # Here parent_list is the eval dict
                    continue

                # Normal command parsing
                command_obj, block_info = self._parse_v4_line(line_content)
                cmd_name = list(command_obj.keys())[0]

                if cmd_name == 'if':
                    is_else = block_info.get('is_else', False)
                    if is_else:
                        if not parent_list or 'if' not in parent_list[-1]:
                            raise ValueError(f"第 {line_num} 行: 'else' 或 'else if' 没有匹配的 'if'")

                        # last_if_struct is the dict like {'if': {...}}
                        last_if_struct = parent_list[-1]

                        # Traverse the chain of else ifs
                        while 'elseCommands' in last_if_struct['if']:
                            else_cmds = last_if_struct['if']['elseCommands']
                            if not else_cmds: # empty else, can attach here
                                break

                            # The next link in the chain must be another 'if' statement.
                            next_if_struct = else_cmds[0]
                            if 'if' not in next_if_struct:
                                # This is a terminal `else` block with actions, not another `else if`.
                                raise ValueError(f"第 {line_num} 行: 在一个最终 'else' 块之后不允许 'else'/'else if'")

                            last_if_struct = next_if_struct

                        # Attach the new command to the last 'if' in the chain.
                        if not command_obj.get('if', {}).get('condition'): # This is a pure 'else'
                             last_if_struct['if']['elseCommands'] = command_obj['if']['commands']
                        else: # This is an 'else if'
                             last_if_struct['if']['elseCommands'] = [command_obj]
                    else:
                        parent_list.append(command_obj)
                else:
                    parent_list.append(command_obj)
                
                # Push new context if a block is started
                if block_info.get('new_block'):
                    context_stack.append((command_obj[cmd_name]['commands'], indent_size, 'commands'))
                elif block_info.get('new_options_block'):
                    context_stack.append((command_obj[cmd_name]['options'], indent_size, 'choice'))
                elif block_info.get('new_notif_block'):
                    context_stack.append((command_obj[cmd_name], indent_size, 'notification.create'))
                elif block_info.get('is_multiline_eval'):
                    context_stack.append((command_obj[cmd_name], indent_size, 'eval'))

            except Exception as e:
                import traceback; traceback.print_exc()
                raise ValueError(f"解析第 {line_num} 行时出错: '{line_content}' -> {e}")

        def cleanup(obj):
            if isinstance(obj, dict):
                for k, v in list(obj.items()):
                    if isinstance(v, dict):
                        if k == 'timer' and 'commands' in v and not v['commands']:
                            del v['commands']
                        cleanup(v)
                    elif isinstance(v, list):
                        cleanup(v)
                    elif k == 'action' and isinstance(v, str):
                        obj[k] = v.strip()
            elif isinstance(obj, list):
                for item in obj:
                    cleanup(item)
        cleanup(v1_data)
        return v1_data


def main():
    parser = argparse.ArgumentParser(description="OEOS v1 (JSON) 和 v4 (OEOScript) 格式转换器。")
    parser.add_argument("direction", choices=['to_v1', 'to_v4'], help="转换方向: 'to_v1' (v4 -> v1), 'to_v4' (v1 -> v4)。")
    parser.add_argument("input_file", help="输入文件路径。")
    parser.add_argument("output_file", help="输出文件路径。")
    args = parser.parse_args()
    try:
        with open(args.input_file, 'r', encoding='utf-8') as f: content = f.read()
    except FileNotFoundError:
        print(f"错误: 输入文件未找到 '{args.input_file}'", file=sys.stderr)
        sys.exit(1)
    converter = OEOSConverter()
    try:
        if args.direction == 'to_v1':
            v1_data = converter.to_v1_main_loop(content.split('\n'), {"pages": {}})
            output_content = json.dumps(v1_data, indent=2, ensure_ascii=False)
        elif args.direction == 'to_v4':
            v1_data = json.loads(content)
            output_content = converter.to_v4(v1_data)
    except Exception as e:
        print(f"转换过程中发生错误: {e}", file=sys.stderr)
        sys.exit(1)
    try:
        with open(args.output_file, 'w', encoding='utf-8') as f: f.write(output_content)
        print(f"转换成功！结果已写入 '{args.output_file}'")
    except IOError as e:
        print(f"错误: 无法写入输出文件 '{args.output_file}': {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()