declare module "ghostscript4js" {
    export function executeAsync(command: string): Promise<void>;
}
