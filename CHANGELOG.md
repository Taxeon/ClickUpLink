# Changelog

All notable changes to the ClickUpLink extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.1] - 2025-08-21

### Improved
- **Enhanced Debugging for Go Files**: Added detailed logging and better error handling for CodeLens in Go files
- **Error Recovery**: Improved resilience when task references fail to load
- **Authentication Checks**: Added explicit authentication verification for Go files

### Fixed
- **CodeLens in Go Files**: Improved troubleshooting for issues with CodeLens breadcrumbs in Go files
- **Error Handling**: Better error messages when tasks can't be loaded

## [1.7.0] - 2025-08-13

### Added
- **Real-time ClickUp Data Refresh**: Task references now automatically refresh with current ClickUp data on extension startup
- **Enhanced Refresh Command**: "Refresh Task References" button now fetches fresh data from ClickUp API instead of just refreshing cached data
- **Progress Indicators**: Added visual progress feedback when manually refreshing task references
- **Authentication-aware Refresh**: Refresh operations now check authentication status and handle unauthenticated scenarios gracefully
- **Added support for jsx/tsx files**: Now automatically detects JSX/TSX files and adds task references for them
- **Auto Refresh Setting for clickup sync**: Settings pane contains a link to set auto refresh time with a default of 60 min and a minimum of 5 min. When ran references will be updated with current Clickup values.
- **Add Support for Sprint Task Selection**: You can now select tasks from a sprint folder adding a reference to the task with the sprint as folder header.

### Improved
- **Data Accuracy**: All task references now display current ClickUp status, assignees, task names, and descriptions
- **Startup Performance**: Background refresh doesn't block extension initialization
- **Error Handling**: Better error messages and graceful fallbacks when ClickUp API calls fail
- **Code Organization**: Unified refresh logic eliminates code duplication and improves maintainability
- **Increased Timeouts**: Increased timeout values for ClickUp API calls to allow more time for longer running operations###

### Changed
- **Refresh Behavior**: Task references now pull live data from ClickUp instead of relying on cached information
- **Minimal Storage**: Extension now stores only essential reference data (position, taskId) and fetches display data fresh from ClickUp

### Fixed
- **ClickUp API Token Expired Error**: Tries to get new token in the event token has expired insted of just showing error.
- **Task Reference Display**: Task names and descriptions now display correctly
- **Remove Completed Tasks**: Feature now removes completed tasks from the tree view
- **Clean Up References**: Now cleans up duplicate references and removes corrupted files

### Removed

### Technical Details
- Refactored refresh functionality to use a unified `refreshFromClickUpWithOptions()` method
- Added automatic refresh on extension startup (when authenticated)
- Enhanced error handling with silent/verbose modes for different scenarios
- Improved type safety and removed unused interface properties

## [1.6.6] - Previous Release
- Various bug fixes and improvements
- Enhanced task reference management
- Improved CodeLens functionality

---

## Release Notes Template for Future Updates

When creating future releases, follow this structure:

### Added
- New features that were added

### Changed  
- Changes in existing functionality

### Improved
- Enhancements to existing features

### Fixed
- Bug fixes

### Deprecated
- Features that are deprecated but still work

### Removed
- Features that were completely removed

### Security
- Security-related changes
</content>
</invoke>
