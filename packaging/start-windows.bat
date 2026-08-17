@echo off
REM Runs opc-tunner using the portable Node.js runtime placed in a "node" folder
REM right next to this file (see packaging/README.md for where to get it).
"%~dp0node\node.exe" "%~dp0opc-tunner.cjs" "%~dp0config\config.yaml"
pause
