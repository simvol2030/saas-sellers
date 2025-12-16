#!/usr/bin/env python3
"""
Post-Agent Validation Script for Static → SvelteKit Migration Protocol v3.0

Validates agent outputs after completion to ensure quality and prevent errors.
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Set, Optional


class PostAgentValidator:
    """Validates agent outputs after completion."""

    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.metrics: Dict[str, any] = {}

    def check_file_size_limits(self, files: List[Path], max_lines: int) -> bool:
        """Check that generated files don't exceed line limits."""
        oversized = []

        for file_path in files:
            if not file_path.exists():
                continue

            line_count = len(file_path.read_text().splitlines())

            if line_count > max_lines:
                oversized.append((file_path.name, line_count))

        if oversized:
            self.errors.append(
                f"❌ Files exceed {max_lines} line limit:"
            )
            for name, count in oversized:
                self.errors.append(f"   - {name}: {count} lines")

            return False

        return True

    def detect_code_duplication(self) -> Dict[str, List[str]]:
        """Detect duplicate components/interfaces/types."""
        duplicates = {
            "components": [],
            "interfaces": [],
            "mock_files": []
        }

        # Check for duplicate component names
        component_names: Dict[str, List[Path]] = {}

        for svelte_file in self.project_root.glob("src/lib/components/**/*.svelte"):
            name = svelte_file.stem
            if name not in component_names:
                component_names[name] = []
            component_names[name].append(svelte_file)

        for name, paths in component_names.items():
            if len(paths) > 1:
                duplicates["components"].append(
                    f"{name}: {', '.join(str(p.relative_to(self.project_root)) for p in paths)}"
                )

        # Check for duplicate interface definitions
        types_file = self.project_root / "src/lib/types/index.ts"

        if types_file.exists():
            content = types_file.read_text()
            interface_names: Set[str] = set()
            duplicate_interfaces: Set[str] = set()

            for match in re.finditer(r'export interface (\w+)', content):
                interface_name = match.group(1)
                if interface_name in interface_names:
                    duplicate_interfaces.add(interface_name)
                interface_names.add(interface_name)

            duplicates["interfaces"] = list(duplicate_interfaces)

        # Check for duplicate mock file content (by comparing product IDs)
        mock_dir = self.project_root / "src/lib/data/mock"

        if mock_dir.exists():
            all_ids: Dict[str, List[str]] = {}

            for json_file in mock_dir.glob("*.json"):
                try:
                    data = json.loads(json_file.read_text())

                    if isinstance(data, list):
                        for item in data:
                            if isinstance(item, dict) and "id" in item:
                                item_id = item["id"]
                                if item_id not in all_ids:
                                    all_ids[item_id] = []
                                all_ids[item_id].append(json_file.name)
                except json.JSONDecodeError:
                    self.warnings.append(f"⚠️  Invalid JSON: {json_file.name}")

            for item_id, files in all_ids.items():
                if len(files) > 1:
                    duplicates["mock_files"].append(
                        f"ID '{item_id}' in: {', '.join(files)}"
                    )

        return duplicates

    def validate_typescript_interfaces(self) -> bool:
        """Check for common TypeScript interface issues."""
        types_file = self.project_root / "src/lib/types/index.ts"

        if not types_file.exists():
            self.warnings.append("⚠️  No types/index.ts found")
            return True

        content = types_file.read_text()

        # Check for missing exports
        interfaces = re.findall(r'interface (\w+)', content)
        exported = re.findall(r'export interface (\w+)', content)

        non_exported = set(interfaces) - set(exported)
        if non_exported:
            self.warnings.append(
                f"⚠️  Non-exported interfaces: {', '.join(non_exported)}"
            )

        # Check for optional fields that should extend existing interfaces
        if "interface Product" in content:
            product_count = content.count("interface Product")
            if product_count > 1:
                self.errors.append(
                    "❌ Multiple Product interface definitions found - should extend existing!"
                )
                return False

        return True

    def run_npm_check(self) -> Optional[str]:
        """Run npm run check and return output."""
        try:
            result = subprocess.run(
                ["npm", "run", "check"],
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=60
            )

            return result.stdout + result.stderr

        except subprocess.TimeoutExpired:
            self.errors.append("❌ npm run check timed out")
            return None
        except FileNotFoundError:
            self.warnings.append("⚠️  npm not found - skipping type check")
            return None

    def parse_npm_check_output(self, output: str) -> Dict[str, any]:
        """Parse npm run check output for errors and warnings."""
        result = {
            "errors": 0,
            "warnings": 0,
            "files_with_errors": []
        }

        if not output:
            return result

        # Extract error count
        error_match = re.search(r'(\d+) errors?', output)
        if error_match:
            result["errors"] = int(error_match.group(1))

        # Extract warning count
        warning_match = re.search(r'(\d+) warnings?', output)
        if warning_match:
            result["warnings"] = int(warning_match.group(1))

        # Extract files with errors
        file_pattern = r'(src/[^\s:]+\.(?:svelte|ts|js)):'
        result["files_with_errors"] = list(set(re.findall(file_pattern, output)))

        return result

    def validate_mock_data_structure(self) -> bool:
        """Validate mock JSON files for proper structure."""
        mock_dir = self.project_root / "src/lib/data/mock"

        if not mock_dir.exists():
            return True

        for json_file in mock_dir.glob("*.json"):
            try:
                data = json.loads(json_file.read_text())

                if not isinstance(data, list):
                    self.warnings.append(
                        f"⚠️  {json_file.name}: Expected array, got {type(data).__name__}"
                    )
                    continue

                # Check entry count
                if len(data) > 15:
                    self.warnings.append(
                        f"⚠️  {json_file.name}: {len(data)} entries (recommend max 15)"
                    )

                # Validate structure
                for i, item in enumerate(data):
                    if not isinstance(item, dict):
                        self.warnings.append(
                            f"⚠️  {json_file.name}[{i}]: Not an object"
                        )
                        continue

                    if "id" not in item:
                        self.warnings.append(
                            f"⚠️  {json_file.name}[{i}]: Missing 'id' field"
                        )

            except json.JSONDecodeError as e:
                self.errors.append(f"❌ {json_file.name}: Invalid JSON - {e}")
                return False

        return True

    def validate_component_best_practices(self, component_files: List[Path]) -> bool:
        """Check Svelte components for best practices."""
        deprecated_patterns = [
            (r'<svelte:component\s+this=', "Deprecated <svelte:component>"),
            (r'from\s+["\']svelte/store["\']', "Deprecated stores (use runes)"),
            (r'writable\(', "Deprecated writable store (use $state)"),
            (r'readable\(', "Deprecated readable store (use $state)"),
            (r'derived\(', "Deprecated derived store (use $derived)"),
        ]

        for component_file in component_files:
            if not component_file.exists() or component_file.suffix != ".svelte":
                continue

            content = component_file.read_text()

            # Check for deprecated patterns
            for pattern, description in deprecated_patterns:
                if re.search(pattern, content):
                    self.warnings.append(
                        f"⚠️  {component_file.name}: {description}"
                    )

            # Check for accessibility issues
            if "<button" in content:
                # Check icon buttons have aria-label
                icon_buttons = re.findall(r'<button[^>]*>[\s\n]*<svg', content)
                for match in icon_buttons:
                    if "aria-label" not in match:
                        self.warnings.append(
                            f"⚠️  {component_file.name}: Icon button missing aria-label"
                        )

        return True

    def calculate_metrics(self) -> Dict[str, any]:
        """Calculate migration metrics."""
        metrics = {
            "components_created": 0,
            "types_defined": 0,
            "mock_files": 0,
            "total_lines": 0,
            "typescript_errors": 0,
            "duplication_score": 0
        }

        # Count components
        metrics["components_created"] = len(
            list(self.project_root.glob("src/lib/components/**/*.svelte"))
        )

        # Count types
        types_file = self.project_root / "src/lib/types/index.ts"
        if types_file.exists():
            content = types_file.read_text()
            metrics["types_defined"] = len(
                re.findall(r'export interface \w+', content)
            )

        # Count mock files
        mock_dir = self.project_root / "src/lib/data/mock"
        if mock_dir.exists():
            metrics["mock_files"] = len(list(mock_dir.glob("*.json")))

        # Calculate total lines
        for svelte_file in self.project_root.glob("src/**/*.{svelte,ts,js}"):
            try:
                metrics["total_lines"] += len(svelte_file.read_text().splitlines())
            except:
                pass

        # Get duplication score
        duplicates = self.detect_code_duplication()
        dup_count = (
            len(duplicates["components"]) +
            len(duplicates["interfaces"]) +
            len(duplicates["mock_files"])
        )

        metrics["duplication_score"] = dup_count

        self.metrics = metrics
        return metrics

    def print_report(self):
        """Print validation report."""
        print("\n" + "="*60)
        print("🔍 POST-AGENT VALIDATION REPORT")
        print("="*60 + "\n")

        # Duplication check
        duplicates = self.detect_code_duplication()

        if any(duplicates.values()):
            print("⚠️  CODE DUPLICATION DETECTED:")

            if duplicates["components"]:
                print("\n   Duplicate Components:")
                for dup in duplicates["components"]:
                    print(f"   - {dup}")

            if duplicates["interfaces"]:
                print("\n   Duplicate Interfaces:")
                for dup in duplicates["interfaces"]:
                    print(f"   - {dup}")

            if duplicates["mock_files"]:
                print("\n   Duplicate Mock IDs:")
                for dup in duplicates["mock_files"]:
                    print(f"   - {dup}")

            print()

        # Errors and warnings
        if self.errors:
            print("❌ ERRORS:")
            for error in self.errors:
                print(f"   {error}")
            print()

        if self.warnings:
            print("⚠️  WARNINGS:")
            for warning in self.warnings:
                print(f"   {warning}")
            print()

        # Metrics
        if self.metrics:
            print("📊 METRICS:")
            print(f"   Components: {self.metrics['components_created']}")
            print(f"   Types: {self.metrics['types_defined']}")
            print(f"   Mock files: {self.metrics['mock_files']}")
            print(f"   Total lines: {self.metrics['total_lines']:,}")
            print(f"   TypeScript errors: {self.metrics['typescript_errors']}")
            print(f"   Duplication: {self.metrics['duplication_score']} issues")
            print()

        if not self.errors and not self.warnings:
            print("✅ All checks passed!\n")

        print("="*60 + "\n")

        return len(self.errors) == 0


def main():
    """CLI entry point."""
    if len(sys.argv) < 2:
        print("Usage: post_agent_validator.py <project_root> [--skip-npm-check]")
        sys.exit(1)

    project_root = sys.argv[1]
    skip_npm_check = "--skip-npm-check" in sys.argv

    validator = PostAgentValidator(project_root)

    # Run validations
    print("🔍 Running post-agent validations...\n")

    # 1. Check duplication
    print("1️⃣  Checking for code duplication...")
    validator.detect_code_duplication()

    # 2. Validate TypeScript interfaces
    print("2️⃣  Validating TypeScript interfaces...")
    validator.validate_typescript_interfaces()

    # 3. Validate mock data
    print("3️⃣  Validating mock data structure...")
    validator.validate_mock_data_structure()

    # 4. Check component best practices
    print("4️⃣  Checking component best practices...")
    components = list(Path(project_root).glob("src/lib/components/**/*.svelte"))
    validator.validate_component_best_practices(components)

    # 5. Run npm check
    if not skip_npm_check:
        print("5️⃣  Running npm run check...")
        output = validator.run_npm_check()

        if output:
            check_result = validator.parse_npm_check_output(output)
            validator.metrics["typescript_errors"] = check_result["errors"]

            if check_result["errors"] > 0:
                validator.errors.append(
                    f"❌ npm run check found {check_result['errors']} error(s)"
                )
                validator.errors.append("   Files with errors:")
                for file in check_result["files_with_errors"]:
                    validator.errors.append(f"   - {file}")

    # 6. Calculate metrics
    print("6️⃣  Calculating metrics...\n")
    validator.calculate_metrics()

    # Print report
    success = validator.print_report()

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
