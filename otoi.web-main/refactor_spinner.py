import os
import re

def refactor_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    
    # Only if it contains SpinnerDotted
    if 'SpinnerDotted' not in content:
        return

    # Add ScreenLoader import
    if 'ScreenLoader' not in content:
        import_stmt = 'import { ScreenLoader } from "@/components/loaders";\n'
        content = re.sub(r'(import React[^;\n]*;\n)', r'\g<1>' + import_stmt, content, count=1)
        if import_stmt not in content:
            content = import_stmt + content

    # Remove SpinnerDotted import
    content = re.sub(r'import\s*\{\s*SpinnerDotted\s*\}\s*from\s*[\'"`]spinners-react[\'"`];?\n?', '', content)

    # 1. Exact match for standard return
    pattern1 = re.compile(r'return\s*\(\s*<div[^>]*>\s*<SpinnerDotted[^>]*/>\s*</div>\s*\);')
    content = pattern1.sub('return <ScreenLoader />;', content)

    # 2. Exact match for common overlays
    pattern2 = re.compile(r'<div[^>]*fixed\s+inset-0[^>]*>\s*<div[^>]*>\s*<SpinnerDotted[^>]*/>\s*</div>\s*</div>')
    content = pattern2.sub('<ScreenLoader />', content)

    pattern3 = re.compile(r'<div[^>]*fixed\s+inset-0[^>]*>\s*<SpinnerDotted[^>]*/>\s*</div>')
    content = pattern3.sub('<ScreenLoader />', content)

    pattern4 = re.compile(r'<div[^>]*flex[^>]*items-center[^>]*h-screen[^>]*>\s*<SpinnerDotted[^>]*/>\s*</div>')
    content = pattern4.sub('<ScreenLoader />', content)
    
    # Special exact match for fetchingLead in parties content:
    pattern5 = re.compile(r'<div[^>]*fixed\s+inset-0[^>]*>\s*<div[^>]*>\s*<SpinnerDotted[^>]*/>\s*<span[^>]*>[^<]*</span>\s*</div>\s*</div>')
    content = pattern5.sub('<ScreenLoader />', content)

    # 3. Any standalone <SpinnerDotted ... /> not in the above
    content = re.sub(r'<SpinnerDotted\s*[^>]*/>', '<ScreenLoader />', content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Refactored {filepath}')

src_pages = r'd:\evoto-crm\otoi.web-main\src\pages'
for root, dirs, files in os.walk(src_pages):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            refactor_file(os.path.join(root, file))

