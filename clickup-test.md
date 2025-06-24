# ClickUp Extension Test File

This file is for testing the ClickUp CodeLens functionality.

## Instructions:
1. **Type "clickup"** anywhere in this file (case insensitive: clickup, ClickUp, CLICKUP all work)
2. **Click the CodeLens** that appears to start the selection flow
3. **Select Folder** → **Select List** → **Select Task**
4. **See breadcrumbs**: 📁 Folder Name | 📋 List Name | Task Name - Status | 🔗 Open

## Test Areas:

Type "clickup" here: 

Another test area - type "CLICKUP" below:

Test with any case - "ClickUp" or "clickup" triggers selection flow:


## Expected Behavior:
- Typing "clickup" triggers CodeLens
- Click CodeLens to select Folder > List > Task
- Breadcrumbs appear and are clickable
- Status can be changed in ClickUp
- OPEN link takes you to ClickUp web app

## Authentication Commands:
- Ctrl+Shift+P > "ClickUp: Login" - Start authentication
- Ctrl+Shift+P > "ClickUp: Logout" - Log out
- Ctrl+Shift+P > "ClickUp: Status" - Check auth status
- Ctrl+Shift+P > "ClickUp: Enter Code" - Manual code entry
