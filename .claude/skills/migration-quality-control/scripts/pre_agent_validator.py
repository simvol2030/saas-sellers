#!/usr/bin/env python3
"""
Pre-Agent Validation Script for Static → SvelteKit Migration Protocol v3.0

Validates that all prerequisites are met before launching a migration agent.
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional


class PreAgentValidator:
    """Validates prerequisites before launching migration agents."""

    AGENT_TYPES = [
        "static-to-svelte-analyzer",
        "mock-data-generator",
        "ui-components-builder",
        "page-data-provider-builder",
        "typescript-svelte-error-fixer"
    ]

    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def validate_stage_0_completed(self) -> bool:
        """Verify Stage 0 (inventory) was completed."""
        required_paths = [
            self.project_root / "src/lib/components",
            self.project_root / "src/lib/types/index.ts",
            self.project_root / "src/lib/data/mock"
        ]

        for path in required_paths:
            if not path.exists():
                self.errors.append(f"❌ Stage 0 incomplete: {path} does not exist")
                return False

        return True

    def get_existing_components(self) -> Dict[str, List[str]]:
        """Scan and return existing components."""
        components = {
            "layout": [],
            "ui": [],
        }

        layout_dir = self.project_root / "src/lib/components/layout"
        ui_dir = self.project_root / "src/lib/components/ui"

        if layout_dir.exists():
            components["layout"] = [
                f.stem for f in layout_dir.glob("*.svelte")
            ]

        if ui_dir.exists():
            components["ui"] = [
                f.stem for f in ui_dir.glob("*.svelte")
            ]

        return components

    def get_existing_types(self) -> List[str]:
        """Extract existing TypeScript interfaces."""
        types_file = self.project_root / "src/lib/types/index.ts"

        if not types_file.exists():
            return []

        content = types_file.read_text()
        interfaces = []

        for line in content.split('\n'):
            if line.strip().startswith('export interface'):
                # Extract interface name
                name = line.split('interface')[1].split('{')[0].strip()
                interfaces.append(name)

        return interfaces

    def get_existing_mock_files(self) -> List[str]:
        """List existing mock JSON files."""
        mock_dir = self.project_root / "src/lib/data/mock"

        if not mock_dir.exists():
            return []

        return [f.name for f in mock_dir.glob("*.json")]

    def validate_instruction_for_agent(
        self,
        agent_type: str,
        instruction: str
    ) -> bool:
        """Validate that instruction contains required elements for agent type."""

        if agent_type not in self.AGENT_TYPES:
            self.errors.append(f"❌ Unknown agent type: {agent_type}")
            return False

        # Common checks for all agents
        if "СУЩЕСТВУЮТ" not in instruction and "EXISTING" not in instruction:
            self.warnings.append(
                f"⚠️  Instruction missing EXISTING context for {agent_type}"
            )

        if "НЕ создавай" not in instruction and "DO NOT CREATE" not in instruction:
            self.warnings.append(
                f"⚠️  Instruction missing explicit prohibitions (НЕ создавай) for {agent_type}"
            )

        # Agent-specific checks
        if agent_type == "static-to-svelte-analyzer":
            if "<1500" not in instruction and "<2000" not in instruction:
                self.warnings.append(
                    "⚠️  Analyzer: No line limit specified (recommend <1500)"
                )

        elif agent_type == "mock-data-generator":
            if "15 записей" not in instruction and "10-15" not in instruction:
                self.warnings.append(
                    "⚠️  Mock generator: No entry limit specified (recommend 10-15)"
                )

            existing_mocks = self.get_existing_mock_files()
            if existing_mocks:
                for mock_file in existing_mocks:
                    if mock_file not in instruction:
                        self.warnings.append(
                            f"⚠️  Mock generator: Existing file '{mock_file}' not mentioned in DO NOT CREATE"
                        )

        elif agent_type == "ui-components-builder":
            if "<200 строк" not in instruction and "<200 lines" not in instruction:
                self.warnings.append(
                    "⚠️  UI builder: No component size limit specified (recommend <200 lines)"
                )

            if "TypeScript" not in instruction:
                self.warnings.append(
                    "⚠️  UI builder: TypeScript best practices not mentioned"
                )

            if "Svelte 5" not in instruction:
                self.warnings.append(
                    "⚠️  UI builder: Svelte 5 runes not mentioned"
                )

            if "Accessibility" not in instruction and "A11y" not in instruction:
                self.warnings.append(
                    "⚠️  UI builder: Accessibility requirements not mentioned"
                )

            existing_components = self.get_existing_components()
            all_existing = existing_components["layout"] + existing_components["ui"]

            for component in all_existing:
                if component not in instruction:
                    self.warnings.append(
                        f"⚠️  UI builder: Existing component '{component}' not mentioned in DO NOT CREATE"
                    )

        elif agent_type == "page-data-provider-builder":
            existing_components = self.get_existing_components()

            if "ProductCard" in existing_components["ui"] and "ProductCard" not in instruction:
                self.warnings.append(
                    "⚠️  Page builder: Should mention REUSE of ProductCard"
                )

            if "SEO" not in instruction:
                self.warnings.append(
                    "⚠️  Page builder: SEO requirements not mentioned"
                )

        elif agent_type == "typescript-svelte-error-fixer":
            if "npm run check" not in instruction:
                self.errors.append(
                    "❌ Error fixer: Must include npm run check output"
                )
                return False

            existing_types = self.get_existing_types()
            if existing_types and "types/index.ts" not in instruction:
                self.warnings.append(
                    "⚠️  Error fixer: Should reference existing types in types/index.ts"
                )

        return len(self.errors) == 0

    def generate_context_summary(self) -> str:
        """Generate a context summary for agent instructions."""
        components = self.get_existing_components()
        types = self.get_existing_types()
        mocks = self.get_existing_mock_files()

        summary = "КОНТЕКСТ СУЩЕСТВУЮЩЕГО КОДА:\n"

        if components["layout"]:
            summary += f"✅ Layout: {', '.join(components['layout'])}\n"

        if components["ui"]:
            summary += f"✅ UI: {', '.join(components['ui'])}\n"

        if types:
            summary += f"✅ Types: {', '.join(types)}\n"

        if mocks:
            summary += f"✅ Mock: {', '.join(mocks)}\n"

        return summary

    def print_report(self):
        """Print validation report."""
        print("\n" + "="*60)
        print("🔍 PRE-AGENT VALIDATION REPORT")
        print("="*60 + "\n")

        if self.errors:
            print("❌ ERRORS (must fix before proceeding):")
            for error in self.errors:
                print(f"   {error}")
            print()

        if self.warnings:
            print("⚠️  WARNINGS (recommended to address):")
            for warning in self.warnings:
                print(f"   {warning}")
            print()

        if not self.errors and not self.warnings:
            print("✅ All checks passed!\n")

        print("="*60 + "\n")

        return len(self.errors) == 0


def main():
    """CLI entry point."""
    if len(sys.argv) < 3:
        print("Usage: pre_agent_validator.py <project_root> <agent_type> [instruction_file]")
        print(f"\nSupported agent types: {', '.join(PreAgentValidator.AGENT_TYPES)}")
        sys.exit(1)

    project_root = sys.argv[1]
    agent_type = sys.argv[2]
    instruction_file = sys.argv[3] if len(sys.argv) > 3 else None

    validator = PreAgentValidator(project_root)

    # Validate Stage 0
    print("🔍 Checking Stage 0 (inventory)...")
    if not validator.validate_stage_0_completed():
        validator.print_report()
        sys.exit(1)

    print("✅ Stage 0 completed\n")

    # Generate context summary
    print(validator.generate_context_summary())

    # Validate instruction if provided
    if instruction_file:
        print(f"🔍 Validating instruction for {agent_type}...")

        if not Path(instruction_file).exists():
            print(f"❌ Instruction file not found: {instruction_file}")
            sys.exit(1)

        instruction = Path(instruction_file).read_text()
        validator.validate_instruction_for_agent(agent_type, instruction)

    # Print report
    success = validator.print_report()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
