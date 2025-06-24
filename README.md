# ClickUp Link - VS Code Extension

A VS Code extension that provides seamless ClickUp task integration directly in your code editor with a dedicated sidebar panel and clickable breadcrumb navigation.

## 🚀 Features

- **Dedicated Sidebar Panel**: ClickUp icon in VS Code's activity bar with Authentication, Workspace, and References views
- **One-Click Authentication**: "Login to ClickUp" button in the sidebar (no Command Palette required)
- **Workspace Overview**: See your connected workspace and quick actions in the sidebar
- **Interactive Task References**: Add ClickUp task references anywhere in your code with a simple hotkey
- **Breadcrumb Navigation**: Visual breadcrumbs showing Folder → List → Task → Status with clickable links
- **Persistent References**: Task references survive VS Code reloads and are stored across sessions
- **References Management**: View all task references organized by file in the sidebar
- **Debug Tools**: Built-in debugging commands to inspect and manage stored references
- **Real-time Updates**: Change task status, folder, or list directly from VS Code

## 📦 Installation & Setup

### Step 1: Install the Extension

1. **Development Installation** (Current):
   ```bash
   git clone https://github.com/yourusername/ClickUpLink.git
   cd ClickUpLink
   npm install
   npm run compile
   ```

2. **Open in VS Code**:
   - Open the project in VS Code
   - Press `F5` or run "Run Extension" from the Command Palette
   - A new Extension Development Host window will open

### Step 2: Find the ClickUp Sidebar

1. **Look for the ClickUp Icon**: In the Extension Development Host, look for the ClickUp icon (pulse icon) in the Activity Bar (left sidebar)
2. **Click the Icon**: This opens the ClickUp sidebar panel with three sections:
   - **Authentication** - Login/logout controls
   - **Workspace** - Connected workspace info and quick actions
   - **Task References** - Manage your task references

### Step 3: Authenticate with ClickUp

1. **Click "Login to ClickUp"**: In the Authentication section of the sidebar
2. **Grant Permissions**:
   - Your browser will open to ClickUp's OAuth page
   - Log into your ClickUp account
   - Review and approve the requested permissions
   - You'll be redirected back to VS Code

3. **Verify Connection**: The Authentication section will show "✅ Connected to ClickUp" and the Workspace section will display your workspace info

## 🎯 How to Use the Extension

### ClickUp Sidebar Panel

The extension adds a ClickUp icon to VS Code's Activity Bar. Click it to open the sidebar with three main sections:

#### 🔐 Authentication Section
- **When not logged in**: Shows "Login to ClickUp" button
- **When logged in**: Shows "✅ Connected to ClickUp" and "Logout" button
- **No Command Palette needed** - just click the buttons!

#### 🏢 Workspace Section  
- **Workspace Info**: Shows your connected ClickUp workspace name and ID
- **Quick Actions**: 
  - "Add Task Reference (Ctrl+C+U)" - Quick access to add references
  - "View All References" - Opens debug output to see all stored references

#### 📝 Task References Section
- **Summary**: Shows total number of references across all files
- **Files with References**: Expandable list of files containing task references
  - Click file names to open them
  - Expand files to see individual references
  - Click references to jump to their location
- **Actions**: Add, debug, or clear references

### Adding Task References

1. **Using the Sidebar** (New!):
   - Click "Add Task Reference" in the Workspace section
   - Or click "Add New Reference" in the Task References section

2. **Using Hotkey** (Fastest):
   - Place your cursor anywhere in a file
   - Press `Ctrl+C+U` (Windows/Linux) or `Cmd+C+U` (Mac)
   - A "+Select ClickUp Task" CodeLens will appear at your cursor location

3. **Using Command Palette**:
   - Open Command Palette (`Ctrl+Shift+P`) 
   - Run: `ClickUp: Add Task Reference`

### Configuring Task References

Once you've added a task reference, you'll see a "+Select ClickUp Task" CodeLens. Click it to start configuring:

1. **Select Folder**: Choose which ClickUp folder/space contains your task
2. **Select List**: Pick the specific list within that folder  
3. **Select Task**: Choose the exact task you want to reference
4. **Task Status**: The current status will be displayed and clickable

### Breadcrumb Navigation

After configuring a task reference, you'll see breadcrumbs like:
```
📁 Development | 📋 Sprint 1 | 📝 Fix Login Bug | 🔄 In Progress | 🔗 Open in ClickUp
```

**Each element is clickable**:
- **📁 Folder**: Change to a different folder
- **📋 List**: Switch to a different list  
- **📝 Task**: Select a different task
- **🔄 Status**: Update the task status
- **🔗 Open in ClickUp**: View the task in your browser

### Managing References

**Sidebar Management** (New!):
- **View All References**: In the Task References section, see all references organized by file
- **Quick Navigation**: Click any file or reference to jump directly to it
- **File Overview**: Each file shows the number of references it contains
- **Reference Details**: See task names and line numbers for each reference

**Traditional Methods**:
- **View All References**: Command Palette → `ClickUp: Debug - Show Stored Task References`
- **Clear All References**: Command Palette → `ClickUp: Debug - Clear All Task References`

**Debug Output**:
- All actions are logged to the "ClickUp Link Debug" output panel
- View → Output → "ClickUp Link Debug" for detailed logs

### Persistence

- **Automatic Saving**: All task references are automatically saved
- **Reload Safe**: References persist when you reload VS Code
- **File-Specific**: Each file maintains its own set of references
- **Position Tracking**: References stay at the correct line even when you edit the file

## 🔧 Available Commands

### Sidebar Integration (New!)
- **ClickUp Sidebar Panel**: Click the ClickUp icon in Activity Bar
- **Login Button**: One-click authentication in sidebar
- **Quick Actions**: Add references and view workspace info from sidebar
- **References Management**: View and navigate all references in sidebar

### Command Palette Commands
Open Command Palette (`Ctrl+Shift+P`) for advanced features:

#### Core Commands
- `ClickUp: Add Task Reference` - Add a new task reference at cursor
- `ClickUp: Login` - Connect to your ClickUp account (also available in sidebar)
- `ClickUp: Authentication Status` - Check connection status  
- `ClickUp: Enter Authorization Code` - Manual authentication if OAuth fails
- `ClickUp: Reset Authentication` - Disconnect from ClickUp (also available in sidebar)

### Debug Commands  
- `ClickUp: Debug - Show Stored Task References` - View all stored references
- `ClickUp: Debug - Clear All Task References` - Remove all references

### Internal Commands (Used by CodeLens)
- `ClickUp: Setup Task Reference` - Configure folder/list/task
- `ClickUp: Change Folder` - Switch folder for a reference  
- `ClickUp: Change List` - Switch list for a reference
- `ClickUp: Change Task` - Switch task for a reference
- `ClickUp: Change Status` - Update task status
- `ClickUp: Open in ClickUp` - Open task in browser

## ⌨️ Keyboard Shortcuts

- `Ctrl+C+U` - Add task reference at cursor (Windows/Linux)
- `Cmd+C+U` - Add task reference at cursor (Mac)

## 🛠️ Troubleshooting

### Extension Not Working
1. **Check Sidebar Panel**:
   - Look for ClickUp icon in Activity Bar (left side of VS Code)
   - Click icon to open sidebar and check authentication status
   - Use "Login to ClickUp" button if not connected

2. **Check Extension is Active**:
   - Look for "ClickUp Link extension activated!" notification
   - Check the "ClickUp Link Debug" output panel for activation logs

3. **Reload Extension Development Host**:
   - Press `Ctrl+R` in the Extension Development Host window
   - Or close and restart with `F5`

### Authentication Issues  
1. **Sidebar Authentication**:
   - Open ClickUp sidebar panel 
   - Click "Login to ClickUp" button instead of using Command Palette
   - Check if "✅ Connected to ClickUp" appears after login

2. **Connection Problems**:
   - Check Authentication section in sidebar
   - If not connected, click "Login to ClickUp" button
   - Or use Command Palette: `ClickUp: Login`

3. **Manual Code Entry**:
   - If OAuth redirect fails, use Command Palette: `ClickUp: Enter Authorization Code`
   - Copy the code from your browser manually

### Task References Not Showing
1. **Check Sidebar References Section**:
   - Open ClickUp sidebar panel
   - Look at "Task References" section for summary
   - Expand "Files with References" to see individual files
   - If empty, use "Add New Reference" button

2. **Check Debug Output**:
   - Use sidebar "Actions" → "Show All References (Debug)"  
   - Or Command Palette: `ClickUp: Debug - Show Stored Task References`
   - View output in "ClickUp Link Debug" panel

3. **References Not Persisting**:
   - Check if you're in the same workspace
   - References are file-specific and workspace-specific
   - Verify files haven't been moved or renamed

4. **CodeLens Not Appearing**:
   - Ensure you added references with `Ctrl+C+U` 
   - Only manually added references show CodeLens (not every "clickup" word)
   - Check if file type supports CodeLens

### Performance Issues
1. **Clear Old References**:
   - Run: `ClickUp: Debug - Clear All Task References`
   - Add only the references you actually need

2. **Check Network Connection**:
   - ClickUp API calls require internet access
   - Check firewall settings if requests fail

## 🔍 Debug Panel

The extension includes a dedicated debug output panel for transparency:

**Access Debug Panel**:
1. Go to View → Output  
2. Select "ClickUp Link Debug" from the dropdown
3. All extension activity, errors, and persistence data is logged here

**What You'll See**:
- Extension activation logs
- Authentication status changes  
- Task reference creation/deletion
- API call results
- Error messages and stack traces
- Raw persistence data

## 🏗️ Development & Testing

### Running in Development Mode

1. **Clone and Setup**:
   ```bash
   git clone https://github.com/yourusername/ClickUpLink.git
   cd ClickUpLink
   npm install
   npm run compile
   ```

2. **Run Extension**:
   - Open project in VS Code
   - Press `F5` to launch Extension Development Host
   - Extension will be active in the new window

3. **Test with Sample File**:
   - Open `test-clickup-references.md` in the Extension Development Host
   - Use `Ctrl+C+U` to add task references
   - Test persistence by reloading with `Ctrl+R`

### Building for Production

```bash
npm run compile
npm run package  # If you have vsce installed
```

## 🔒 Privacy & Security

**Data Storage**:
- OAuth tokens stored securely in VS Code's secret storage
- Task references stored in VS Code's global state
- No data transmitted to third parties

**Permissions**:
- Minimal ClickUp API permissions requested
- Read access to workspaces, folders, lists, and tasks
- Write access only for task status updates

**Network Access**:
- Only communicates with ClickUp API (api.clickup.com)
- OAuth authentication through app.clickup.com
- No telemetry or tracking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Ensure all TypeScript compiles: `npm run compile`
5. Submit a pull request

### Development Guidelines

- Follow existing code style and patterns
- Add appropriate error handling
- Update README.md for new features
- Test with the Extension Development Host
- Use the debug commands to verify functionality

## 📋 Feature Roadmap

- [ ] Task creation directly from VS Code
- [ ] Task time tracking integration  
- [ ] Workspace/team member assignment
- [ ] Custom task templates
- [ ] Bulk task operations
- [ ] Integration with VS Code's task system

## 🐛 Known Issues

- Large workspaces with many tasks may have slower loading times
- OAuth redirect may occasionally fail on some systems (use manual code entry as fallback)
- CodeLens positioning may shift slightly when editing files with many changes

## 📞 Support

If you encounter issues:

1. **Check Debug Output**: View → Output → "ClickUp Link Debug"
2. **Try Debug Commands**: Use "Show Stored Task References" to inspect state
3. **Clear and Restart**: Use "Clear All Task References" and restart extension
4. **Check Authentication**: Run "Authentication Status" command

For persistent issues, please create an issue on GitHub with:
- VS Code version
- Extension version  
- Debug panel output
- Steps to reproduce

## 📄 License

MIT License - see LICENSE file for details