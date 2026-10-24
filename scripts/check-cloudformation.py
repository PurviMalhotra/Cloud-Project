"""Run with cfn-lint==1.58.0 and guardpycfn==0.1.0 in an isolated environment."""
from pathlib import Path
import json
import sys
import cfnlint.api
import guardpycfn

source = Path('.deploy/template.json').read_text()
findings = cfnlint.api.lint(s=source, config={'regions': ['ap-southeast-2']})
for finding in findings:
    print(finding.rule.id, finding.message)
failed = any(finding.rule.id.startswith('E') for finding in findings)
for rule in sorted(Path('aws/guard').glob('*.guard')):
    result = guardpycfn.validate_with_guard(source, rule.read_text(), verbose=True)
    status = result['result']['container']['FileCheck']['status']
    print(rule.name, status)
    failed = failed or status not in ('PASS', 'SKIP')
print('Schema findings:', len(findings))
sys.exit(1 if failed else 0)
