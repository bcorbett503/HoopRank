
import os

file_path = '/Users/brettcorbett/.gemini/antigravity/playground/electric-planetary/HoopRank/app/hooprank-starter-with-frontend/hooprank-starter/mobile/lib/screens/home_screen.dart'

with open(file_path, 'r') as f:
    lines = f.readlines()

start_marker = '/* // Challenges Content'
end_marker = '*/ // Team Invites Section'

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if start_marker in line:
        start_idx = i
    if end_marker in line:
        end_idx = i

if start_idx != -1 and end_idx != -1 and start_idx < end_idx:
    print(f"Found block from line {start_idx+1} to {end_idx+1}")
    # Keep the end_marker line but stripped of the */ part?
    # User wants to remove the block. The block IS commented out.
    # We want to remove the comment block completely.
    # The end marker line is `              */ // Team Invites Section`
    # We want to replace it with `              // Team Invites Section`
    
    # New content: lines before start_idx + lines after end_idx (modified)
    
    # We want to keep the indentation of the end marker?
    end_line_content = lines[end_idx].replace('*/ ', '')
    
    new_lines = lines[:start_idx] + [end_line_content] + lines[end_idx+1:]
    
    with open(file_path, 'w') as f:
        f.writelines(new_lines)
    print("Successfully deleted block.")
else:
    print("Block not found or invalid.")
    print(f"Start: {start_idx}, End: {end_idx}")
