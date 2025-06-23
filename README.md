# ClickUp VSCode Extension

A VSCode extension for seamless ClickUp integration

## Features

- ClickUp API integration directly within VSCode
- Secure OAuth2 authentication with ClickUp
- Configurable workspace and project settings
- Real-time task updates and status changes

## Installation

1. Install the extension from the VSCode Marketplace
2. Complete the OAuth2 authentication flow (see below)
3. Select your workspace and preferred project

## Authentication with ClickUp OAuth2

This extension uses OAuth2 for secure authentication with ClickUp:

### Connect Your ClickUp Account

To connect your ClickUp account:

1. Click on the following link or copy it to your browser:
   [Connect your ClickUp account](https://app.clickup.com/api?client_id=XT30CLT9QUIDSAVN6YHYC9SQ44BXG3UK&redirect_uri=https%3A%2F%2Fclickuplink.vercel.app%2Foauth%2Fcallback)
2. If prompted, log in to your ClickUp account
3. Review and approve the requested permissions
4. You'll be redirected back to VS Code to complete the authentication

### How OAuth2 Authentication Works

1. When you activate the extension for the first time, it will prompt you to authenticate
2. You'll be redirected to ClickUp's authentication page in your browser
3. After granting permission, ClickUp will redirect back to VSCode
4. The extension securely stores the authentication tokens
5. The tokens are automatically refreshed when needed

### Benefits of OAuth2 Authentication

- More secure than API tokens
- Limited scope permissions
- No need to manually copy/paste API tokens
- Tokens can be revoked at any time
- Automatically refreshes when expired

### Troubleshooting Authentication

If you encounter authentication issues:

1. In VSCode, open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Type and select "ClickUp: Reset Authentication"
3. Follow the OAuth2 flow again to re-authenticate

### Security Note
- Your OAuth2 tokens are stored securely using VSCode's built-in secret storage
- The extension only requests the minimum permissions needed for functionality
- You can revoke access at any time from your ClickUp account settings

## Workspace Configuration

After authentication:

1. Use the Command Palette to select "ClickUp: Configure Workspace"
2. Choose your preferred workspace from the dropdown
3. Select your default project and task statuses

## Usage

[Usage instructions will go here]

## Extension Commands

- **ClickUp: Start Authentication**: Begin the OAuth2 authentication flow
- **ClickUp: Reset Authentication**: Clear stored tokens and re-authenticate
- **ClickUp: Configure Workspace**: Select your active workspace
- **ClickUp: Create Task**: Create a new ClickUp task
- [More commands will go here]

## Troubleshooting

### Authentication Issues
- Ensure your internet connection is stable during authentication
- If authentication fails, try "ClickUp: Reset Authentication" and try again
- Check your ClickUp account permissions

[More troubleshooting info will go here]

## Privacy & Data Handling

This extension:
- Stores your OAuth2 tokens securely in VSCode's secret storage
- Caches minimal workspace data locally to improve performance
- Does not share or transmit your data to any third-party services

## Contributing

[Contribution guidelines will go here]

## License

[License information will go here]