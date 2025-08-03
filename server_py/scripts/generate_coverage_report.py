#!/usr/bin/env python3
"""
Test Coverage Report Generator

Generates comprehensive test coverage reports for the Pictallion Python backend,
including detailed analysis, trending, and actionable insights.
"""

import os
import sys
import json
import subprocess
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
import argparse


class CoverageReportGenerator:
    """Generate comprehensive test coverage reports."""
    
    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.coverage_dir = project_root / "coverage_reports"
        self.coverage_dir.mkdir(exist_ok=True)
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    def run_tests_with_coverage(self, test_categories: Optional[List[str]] = None) -> bool:
        """Run tests with coverage collection."""
        print("🔍 Running tests with coverage collection...")
        
        cmd = [
            "pytest",
            "--cov=app",
            "--cov-report=xml",
            "--cov-report=html",
            "--cov-report=term-missing",
            "--cov-report=json",
            "-v"
        ]
        
        if test_categories:
            for category in test_categories:
                cmd.extend(["-m", category])
        else:
            # Run all test files
            cmd.extend([
                "tests/test_database_comprehensive.py",
                "tests/test_services_comprehensive.py", 
                "tests/test_api_routes_comprehensive.py",
                "tests/test_integration_workflows.py"
            ])
        
        try:
            result = subprocess.run(
                cmd,
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=600  # 10 minutes timeout
            )
            
            if result.returncode == 0:
                print("✅ Tests completed successfully")
                return True
            else:
                print(f"❌ Tests failed with return code {result.returncode}")
                print("STDOUT:", result.stdout)
                print("STDERR:", result.stderr)
                return False
                
        except subprocess.TimeoutExpired:
            print("⏱️ Tests timed out after 10 minutes")
            return False
        except Exception as e:
            print(f"💥 Error running tests: {e}")
            return False
    
    def parse_xml_coverage(self) -> Dict[str, Any]:
        """Parse XML coverage report."""
        xml_file = self.project_root / "coverage.xml"
        if not xml_file.exists():
            print("⚠️ coverage.xml not found")
            return {}
        
        try:
            tree = ET.parse(xml_file)
            root = tree.getroot()
            
            coverage_data = {
                "overall": {},
                "packages": {},
                "classes": {},
                "files": {}
            }
            
            # Overall coverage
            if root.attrib:
                coverage_data["overall"] = {
                    "line_rate": float(root.attrib.get("line-rate", 0)) * 100,
                    "branch_rate": float(root.attrib.get("branch-rate", 0)) * 100,
                    "lines_covered": int(root.attrib.get("lines-covered", 0)),
                    "lines_valid": int(root.attrib.get("lines-valid", 0)),
                    "branches_covered": int(root.attrib.get("branches-covered", 0)),
                    "branches_valid": int(root.attrib.get("branches-valid", 0))
                }
            
            # Package-level coverage
            for package in root.findall(".//package"):
                package_name = package.attrib.get("name", "unknown")
                coverage_data["packages"][package_name] = {
                    "line_rate": float(package.attrib.get("line-rate", 0)) * 100,
                    "branch_rate": float(package.attrib.get("branch-rate", 0)) * 100
                }
                
                # Class-level coverage
                for class_elem in package.findall(".//class"):
                    class_name = class_elem.attrib.get("name", "unknown")
                    filename = class_elem.attrib.get("filename", "unknown")
                    
                    coverage_data["classes"][f"{package_name}.{class_name}"] = {
                        "filename": filename,
                        "line_rate": float(class_elem.attrib.get("line-rate", 0)) * 100,
                        "branch_rate": float(class_elem.attrib.get("branch-rate", 0)) * 100
                    }
                    
                    # File-level coverage
                    if filename not in coverage_data["files"]:
                        coverage_data["files"][filename] = {
                            "line_rate": float(class_elem.attrib.get("line-rate", 0)) * 100,
                            "branch_rate": float(class_elem.attrib.get("branch-rate", 0)) * 100,
                            "lines": []
                        }
                    
                    # Line-level coverage
                    for line in class_elem.findall(".//line"):
                        line_data = {
                            "number": int(line.attrib.get("number", 0)),
                            "hits": int(line.attrib.get("hits", 0)),
                            "branch": line.attrib.get("branch", "false") == "true"
                        }
                        coverage_data["files"][filename]["lines"].append(line_data)
            
            return coverage_data
            
        except Exception as e:
            print(f"💥 Error parsing XML coverage: {e}")
            return {}
    
    def parse_json_coverage(self) -> Dict[str, Any]:
        """Parse JSON coverage report."""
        json_file = self.project_root / "coverage.json"
        if not json_file.exists():
            print("⚠️ coverage.json not found")
            return {}
        
        try:
            with open(json_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"💥 Error parsing JSON coverage: {e}")
            return {}
    
    def analyze_coverage(self, xml_data: Dict, json_data: Dict) -> Dict[str, Any]:
        """Analyze coverage data and generate insights."""
        analysis = {
            "summary": {},
            "by_component": {},
            "uncovered_lines": {},
            "recommendations": [],
            "trends": {},
            "quality_score": 0
        }
        
        # Overall summary
        if xml_data.get("overall"):
            overall = xml_data["overall"]
            analysis["summary"] = {
                "line_coverage": overall.get("line_rate", 0),
                "branch_coverage": overall.get("branch_rate", 0),
                "lines_covered": overall.get("lines_covered", 0),
                "lines_total": overall.get("lines_valid", 0),
                "branches_covered": overall.get("branches_covered", 0),
                "branches_total": overall.get("branches_valid", 0)
            }
        
        # Component analysis
        components = {
            "app/models": "Database Models",
            "app/services": "Service Layer", 
            "app/api": "API Routes",
            "app/core": "Core Components"
        }
        
        for component_path, component_name in components.items():
            component_files = [
                filename for filename in xml_data.get("files", {}).keys()
                if component_path in filename
            ]
            
            if component_files:
                total_lines = 0
                covered_lines = 0
                
                for filename in component_files:
                    file_data = xml_data["files"][filename]
                    line_rate = file_data.get("line_rate", 0)
                    file_lines = len(file_data.get("lines", []))
                    
                    total_lines += file_lines
                    covered_lines += int(file_lines * line_rate / 100)
                
                component_coverage = (covered_lines / total_lines * 100) if total_lines > 0 else 0
                
                analysis["by_component"][component_name] = {
                    "coverage": component_coverage,
                    "files_count": len(component_files),
                    "total_lines": total_lines,
                    "covered_lines": covered_lines
                }
        
        # Uncovered lines analysis
        for filename, file_data in xml_data.get("files", {}).items():
            uncovered_lines = []
            for line in file_data.get("lines", []):
                if line.get("hits", 0) == 0:
                    uncovered_lines.append(line.get("number", 0))
            
            if uncovered_lines:
                analysis["uncovered_lines"][filename] = uncovered_lines
        
        # Generate recommendations
        overall_coverage = analysis["summary"].get("line_coverage", 0)
        
        if overall_coverage < 85:
            analysis["recommendations"].append({
                "type": "critical",
                "message": f"Overall coverage {overall_coverage:.1f}% is below 85% threshold",
                "action": "Add tests for uncovered code paths"
            })
        elif overall_coverage < 90:
            analysis["recommendations"].append({
                "type": "warning", 
                "message": f"Overall coverage {overall_coverage:.1f}% is below 90% target",
                "action": "Improve test coverage for better quality assurance"
            })
        
        # Component-specific recommendations
        for component, data in analysis["by_component"].items():
            coverage = data["coverage"]
            if coverage < 80:
                analysis["recommendations"].append({
                    "type": "warning",
                    "message": f"{component} coverage {coverage:.1f}% needs improvement",
                    "action": f"Add more comprehensive tests for {component}"
                })
        
        # Quality score calculation
        line_coverage = analysis["summary"].get("line_coverage", 0)
        branch_coverage = analysis["summary"].get("branch_coverage", 0)
        component_balance = self._calculate_component_balance(analysis["by_component"])
        
        analysis["quality_score"] = (
            line_coverage * 0.4 +
            branch_coverage * 0.3 + 
            component_balance * 0.3
        )
        
        return analysis
    
    def _calculate_component_balance(self, components: Dict) -> float:
        """Calculate how balanced coverage is across components."""
        if not components:
            return 0
        
        coverages = [comp["coverage"] for comp in components.values()]
        avg_coverage = sum(coverages) / len(coverages)
        variance = sum((c - avg_coverage) ** 2 for c in coverages) / len(coverages)
        
        # Higher score for lower variance (more balanced)
        balance_score = max(0, 100 - variance)
        return balance_score
    
    def generate_html_report(self, analysis: Dict) -> Path:
        """Generate comprehensive HTML coverage report."""
        html_content = self._create_html_template(analysis)
        
        report_file = self.coverage_dir / f"coverage_report_{self.timestamp}.html"
        with open(report_file, 'w') as f:
            f.write(html_content)
        
        return report_file
    
    def _create_html_template(self, analysis: Dict) -> str:
        """Create HTML template for coverage report."""
        summary = analysis.get("summary", {})
        components = analysis.get("by_component", {})
        recommendations = analysis.get("recommendations", [])
        quality_score = analysis.get("quality_score", 0)
        
        html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pictallion Python Backend - Test Coverage Report</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        .header {{ background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 30px; }}
        .card {{ background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }}
        .metric {{ display: inline-block; margin: 10px; padding: 15px; background: #f8f9fa; border-radius: 6px; min-width: 120px; text-align: center; }}
        .metric-value {{ font-size: 24px; font-weight: bold; color: #2563eb; }}
        .metric-label {{ font-size: 12px; color: #6b7280; text-transform: uppercase; }}
        .progress-bar {{ background: #e5e7eb; border-radius: 10px; height: 20px; margin: 10px 0; }}
        .progress-fill {{ background: linear-gradient(90deg, #10b981, #059669); height: 100%; border-radius: 10px; transition: width 0.3s; }}
        .excellent {{ color: #10b981; }}
        .good {{ color: #f59e0b; }}
        .poor {{ color: #ef4444; }}
        .recommendation {{ padding: 15px; margin: 10px 0; border-left: 4px solid; border-radius: 4px; }}
        .recommendation.critical {{ background: #fef2f2; border-color: #ef4444; }}
        .recommendation.warning {{ background: #fffbeb; border-color: #f59e0b; }}
        .recommendation.info {{ background: #eff6ff; border-color: #3b82f6; }}
        table {{ width: 100%; border-collapse: collapse; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }}
        th {{ background: #f8f9fa; font-weight: 600; }}
        .timestamp {{ color: #6b7280; font-size: 14px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Test Coverage Report</h1>
            <p>Pictallion Python Backend - Generated {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            <div class="timestamp">Quality Score: <span class="metric-value {'excellent' if quality_score >= 90 else 'good' if quality_score >= 75 else 'poor'}">{quality_score:.1f}/100</span></div>
        </div>
        
        <div class="card">
            <h2>📊 Coverage Summary</h2>
            <div>
                <div class="metric">
                    <div class="metric-value {'excellent' if summary.get('line_coverage', 0) >= 90 else 'good' if summary.get('line_coverage', 0) >= 75 else 'poor'}">{summary.get('line_coverage', 0):.1f}%</div>
                    <div class="metric-label">Line Coverage</div>
                </div>
                <div class="metric">
                    <div class="metric-value {'excellent' if summary.get('branch_coverage', 0) >= 85 else 'good' if summary.get('branch_coverage', 0) >= 70 else 'poor'}">{summary.get('branch_coverage', 0):.1f}%</div>
                    <div class="metric-label">Branch Coverage</div>
                </div>
                <div class="metric">
                    <div class="metric-value">{summary.get('lines_covered', 0):,}</div>
                    <div class="metric-label">Lines Covered</div>
                </div>
                <div class="metric">
                    <div class="metric-value">{summary.get('lines_total', 0):,}</div>
                    <div class="metric-label">Total Lines</div>
                </div>
            </div>
            
            <div class="progress-bar">
                <div class="progress-fill" style="width: {summary.get('line_coverage', 0)}%"></div>
            </div>
            <p>Overall line coverage: {summary.get('lines_covered', 0):,} of {summary.get('lines_total', 0):,} lines covered</p>
        </div>
        
        <div class="card">
            <h2>🏗️ Coverage by Component</h2>
            <table>
                <thead>
                    <tr>
                        <th>Component</th>
                        <th>Coverage</th>
                        <th>Files</th>
                        <th>Lines Covered</th>
                        <th>Total Lines</th>
                    </tr>
                </thead>
                <tbody>
"""
        
        for component, data in components.items():
            coverage = data["coverage"]
            status_class = "excellent" if coverage >= 90 else "good" if coverage >= 75 else "poor"
            html += f"""
                    <tr>
                        <td>{component}</td>
                        <td><span class="{status_class}">{coverage:.1f}%</span></td>
                        <td>{data["files_count"]}</td>
                        <td>{data["covered_lines"]:,}</td>
                        <td>{data["total_lines"]:,}</td>
                    </tr>
"""
        
        html += """
                </tbody>
            </table>
        </div>
"""
        
        if recommendations:
            html += """
        <div class="card">
            <h2>💡 Recommendations</h2>
"""
            for rec in recommendations:
                html += f"""
            <div class="recommendation {rec['type']}">
                <strong>{rec['message']}</strong><br>
                <small>{rec['action']}</small>
            </div>
"""
            html += "</div>"
        
        html += """
        <div class="card">
            <h2>📈 Coverage Targets</h2>
            <table>
                <thead>
                    <tr>
                        <th>Component</th>
                        <th>Current</th>
                        <th>Target</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Overall Coverage</td>
                        <td>{:.1f}%</td>
                        <td>≥90%</td>
                        <td>{}</td>
                    </tr>
                    <tr>
                        <td>Database Models</td>
                        <td>{:.1f}%</td>
                        <td>≥95%</td>
                        <td>{}</td>
                    </tr>
                    <tr>
                        <td>Service Layer</td>
                        <td>{:.1f}%</td>
                        <td>≥90%</td>
                        <td>{}</td>
                    </tr>
                    <tr>
                        <td>API Routes</td>
                        <td>{:.1f}%</td>
                        <td>≥85%</td>
                        <td>{}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>
""".format(
            summary.get('line_coverage', 0),
            "✅" if summary.get('line_coverage', 0) >= 90 else "❌",
            components.get('Database Models', {}).get('coverage', 0),
            "✅" if components.get('Database Models', {}).get('coverage', 0) >= 95 else "❌",
            components.get('Service Layer', {}).get('coverage', 0),
            "✅" if components.get('Service Layer', {}).get('coverage', 0) >= 90 else "❌",
            components.get('API Routes', {}).get('coverage', 0),
            "✅" if components.get('API Routes', {}).get('coverage', 0) >= 85 else "❌"
        )
        
        return html
    
    def save_json_report(self, analysis: Dict) -> Path:
        """Save analysis as JSON for programmatic access."""
        report_file = self.coverage_dir / f"coverage_analysis_{self.timestamp}.json"
        
        report_data = {
            "timestamp": self.timestamp,
            "generated_at": datetime.now().isoformat(),
            "analysis": analysis
        }
        
        with open(report_file, 'w') as f:
            json.dump(report_data, f, indent=2)
        
        return report_file
    
    def generate_summary_report(self, analysis: Dict) -> str:
        """Generate text summary for console output."""
        summary = analysis.get("summary", {})
        components = analysis.get("by_component", {})
        recommendations = analysis.get("recommendations", [])
        quality_score = analysis.get("quality_score", 0)
        
        report = f"""
🧪 TEST COVERAGE REPORT
{'=' * 50}

📊 OVERALL METRICS
Line Coverage:    {summary.get('line_coverage', 0):.1f}%
Branch Coverage:  {summary.get('branch_coverage', 0):.1f}%
Lines Covered:    {summary.get('lines_covered', 0):,} / {summary.get('lines_total', 0):,}
Quality Score:    {quality_score:.1f}/100

🏗️ COMPONENT BREAKDOWN
"""
        
        for component, data in components.items():
            status = "✅" if data["coverage"] >= 85 else "⚠️" if data["coverage"] >= 70 else "❌"
            report += f"{status} {component:<20} {data['coverage']:6.1f}% ({data['files_count']} files)\n"
        
        if recommendations:
            report += f"\n💡 RECOMMENDATIONS ({len(recommendations)})\n"
            for i, rec in enumerate(recommendations, 1):
                icon = "🔴" if rec["type"] == "critical" else "🟡"
                report += f"{icon} {i}. {rec['message']}\n"
        
        # Coverage status
        overall_coverage = summary.get('line_coverage', 0)
        if overall_coverage >= 90:
            status_msg = "🎉 Excellent coverage! Keep up the good work."
        elif overall_coverage >= 75:
            status_msg = "👍 Good coverage, but room for improvement."
        else:
            status_msg = "⚠️ Coverage needs significant improvement."
        
        report += f"\n{status_msg}\n"
        report += "=" * 50
        
        return report
    
    def run(self, test_categories: Optional[List[str]] = None, 
            output_formats: List[str] = None) -> bool:
        """Run complete coverage analysis."""
        if output_formats is None:
            output_formats = ["console", "html", "json"]
        
        print(f"🚀 Starting coverage analysis at {datetime.now()}")
        
        # Run tests with coverage
        if not self.run_tests_with_coverage(test_categories):
            return False
        
        # Parse coverage data
        print("📈 Parsing coverage data...")
        xml_data = self.parse_xml_coverage()
        json_data = self.parse_json_coverage()
        
        if not xml_data and not json_data:
            print("❌ No coverage data found")
            return False
        
        # Analyze coverage
        print("🔍 Analyzing coverage...")
        analysis = self.analyze_coverage(xml_data, json_data)
        
        # Generate reports
        generated_files = []
        
        if "console" in output_formats:
            summary = self.generate_summary_report(analysis)
            print(summary)
        
        if "html" in output_formats:
            html_file = self.generate_html_report(analysis)
            generated_files.append(html_file)
            print(f"📄 HTML report: {html_file}")
        
        if "json" in output_formats:
            json_file = self.save_json_report(analysis)
            generated_files.append(json_file)
            print(f"📊 JSON report: {json_file}")
        
        print(f"✅ Coverage analysis complete. Reports saved to {self.coverage_dir}")
        return True


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Generate test coverage reports")
    parser.add_argument(
        "--categories", 
        nargs="*", 
        help="Test categories to run (database, service, api, integration)"
    )
    parser.add_argument(
        "--formats",
        nargs="*",
        default=["console", "html", "json"],
        help="Output formats (console, html, json)"
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path(__file__).parent.parent,
        help="Project root directory"
    )
    
    args = parser.parse_args()
    
    generator = CoverageReportGenerator(args.project_root)
    success = generator.run(args.categories, args.formats)
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()