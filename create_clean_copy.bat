@echo off
set "SourceDir=."
set "TargetDir=..\_Project-GIGI_CLEAN_SOURCE"
set "ExcludeFile=exclude_list.txt"

echo node_modules> %ExcludeFile%
echo functions\lib>> %ExcludeFile%
echo components\media>> %ExcludeFile%
echo 2015-07-04_Backyard_BBQ>> %ExcludeFile%

REM --- Create the clean copy (excluding bloat folders) ---
echo Creating clean source copy...
xcopy %SourceDir% %TargetDir%\ /EXCLUDE:%ExcludeFile% /E /I /H /K /Y > NUL

REM --- Clean up the specific files you don't want ---
echo Removing specific files...
del /Q %TargetDir%\package-lock.json
del /Q %TargetDir%\dir_file_struct.txt
del /Q %TargetDir%\dir_structure.txt
del /Q %TargetDir%\tng_nemesis_intruder_alert.mp3
del /Q %TargetDir%\%ExcludeFile%

echo Clean copy created in: %TargetDir%