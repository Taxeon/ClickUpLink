import * as vscode from 'vscode';

export interface InputBoxOptions {
  title?: string;
  prompt?: string;
  placeholder?: string;
  value?: string;
  password?: boolean;
  ignoreFocusOut?: boolean;
  validationMessage?: string;
  validateInput?: (value: string) => string | undefined | null | Thenable<string | undefined | null>;
}

export interface CreateDialogField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'dropdown' | 'checkbox';
  options?: string[];
  placeholder?: string;
  defaultValue?: string | boolean;
  required?: boolean;
  validateInput?: (value: string) => string | undefined | null | Thenable<string | undefined | null>;
}

export interface CreateDialogOptions {
  title: string;
  step?: string;
  totalSteps?: number;
  fields: CreateDialogField[];
  ignoreFocusOut?: boolean;
  buttons?: vscode.QuickInputButton[];
}

export class CreateDialog {
  /**
   * Create a multi-field dialog for creating entities
   */
  static async show(options: CreateDialogOptions): Promise<Record<string, any> | undefined> {
    const inputBox = vscode.window.createInputBox();
    const result: Record<string, any> = {};
    
    inputBox.ignoreFocusOut = options.ignoreFocusOut ?? true;
    
    if (options.buttons) {
      inputBox.buttons = options.buttons;
    }
    
    for (let i = 0; i < options.fields.length; i++) {
      const field = options.fields[i];
      let value = await this.showInputField(inputBox, field, i + 1, options.fields.length, options.title);
      
      if (value === undefined) {
        // User cancelled the input
        return undefined;
      }
      
      // Convert checkbox value if needed
      if (field.type === 'checkbox') {
        result[field.name] = value === 'true';
      } else {
        result[field.name] = value;
      }
    }
    
    return result;
  }
  
  /**
   * Show a single field in the multi-step dialog
   */
  private static async showInputField(
    inputBox: vscode.InputBox,
    field: CreateDialogField,
    step: number,
    totalSteps: number,
    title: string
  ): Promise<string | undefined> {
    return new Promise<string | undefined>((resolve) => {
      // Configure InputBox for this field
      inputBox.title = `${title} (${step}/${totalSteps})`;
      inputBox.prompt = field.label + (field.required ? ' (required)' : '');
      inputBox.placeholder = field.placeholder;
      inputBox.password = field.type === 'password';
      
      // Handle dropdown type
      if (field.type === 'dropdown' && field.options?.length) {
        const quickPick = vscode.window.createQuickPick();
        quickPick.title = `${title} (${step}/${totalSteps})`;
        quickPick.placeholder = field.label;
        quickPick.items = field.options.map(opt => ({ label: opt }));
        
        if (field.defaultValue && typeof field.defaultValue === 'string') {
          const defaultItem = quickPick.items.find(item => item.label === field.defaultValue);
          if (defaultItem) {
            quickPick.activeItems = [defaultItem];
          }
        }
        
        quickPick.onDidAccept(() => {
          const selected = quickPick.selectedItems[0];
          quickPick.hide();
          resolve(selected ? selected.label : undefined);
        });
        
        quickPick.onDidHide(() => {
          quickPick.dispose();
          if (!quickPick.selectedItems.length) {
            resolve(undefined);
          }
        });
        
        quickPick.show();
        return;
      }

      // Handle checkbox type
      if (field.type === 'checkbox') {
        const quickPick = vscode.window.createQuickPick();
        quickPick.title = `${title} (${step}/${totalSteps})`;
        quickPick.placeholder = field.label;
        quickPick.items = [
          { label: 'Yes', picked: field.defaultValue === true },
          { label: 'No', picked: field.defaultValue === false }
        ];
        
        quickPick.onDidAccept(() => {
          const selected = quickPick.selectedItems[0];
          quickPick.hide();
          resolve(selected ? (selected.label === 'Yes' ? 'true' : 'false') : 'false');
        });
        
        quickPick.onDidHide(() => {
          quickPick.dispose();
          if (!quickPick.selectedItems.length) {
            resolve(undefined);
          }
        });
        
        quickPick.show();
        return;
      }
      
      // Handle text and password types
      if (field.defaultValue && typeof field.defaultValue === 'string') {
        inputBox.value = field.defaultValue;
      } else {
        inputBox.value = '';
      }
      
      // Set up validation
      if (field.validateInput) {
        inputBox.validationMessage = '';
        inputBox.onDidChangeValue(async (value) => {
          const validationResult = await field.validateInput!(value);
          if (validationResult) {
            inputBox.validationMessage = validationResult;
          } else {
            inputBox.validationMessage = '';
          }
        });
      }
      
      // Handle acceptance
      inputBox.onDidAccept(async () => {
        const value = inputBox.value.trim();
        
        // Required field validation
        if (field.required && !value) {
          inputBox.validationMessage = 'This field is required';
          return;
        }
        
        // Custom validation
        if (field.validateInput) {
          const validationResult = await field.validateInput(value);
          if (validationResult) {
            inputBox.validationMessage = validationResult;
            return;
          }
        }
        
        inputBox.hide();
        resolve(value);
      });
      
      // Handle cancellation
      inputBox.onDidHide(() => {
        if (!inputBox.value && field.required) {
          resolve(undefined);
        }
      });
      
      inputBox.show();
    });
  }
}