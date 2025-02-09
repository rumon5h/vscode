/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { extHostNamedCustomer, IExtHostContext } from 'vs/workbench/services/extensions/common/extHostCustomers';
import { ILoggerOptions, ILoggerService, ILogService, log, LogLevel, LogLevelToString, parseLogLevel } from 'vs/platform/log/common/log';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { ExtHostContext, MainThreadLoggerShape, MainContext } from 'vs/workbench/api/common/extHost.protocol';
import { UriComponents, URI } from 'vs/base/common/uri';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { IOutputService } from 'vs/workbench/services/output/common/output';

@extHostNamedCustomer(MainContext.MainThreadLogger)
export class MainThreadLoggerService implements MainThreadLoggerShape {

	private readonly disposables = new DisposableStore();

	constructor(
		extHostContext: IExtHostContext,
		@ILogService logService: ILogService,
		@ILoggerService private readonly loggerService: ILoggerService,
		@IOutputService outputService: IOutputService,
	) {
		const proxy = extHostContext.getProxy(ExtHostContext.ExtHostLogLevelServiceShape);
		this.disposables.add(logService.onDidChangeLogLevel(level => proxy.$setLevel(level)));
		this.disposables.add(loggerService.onDidChangeLogLevel(([resource, logLevel]) => proxy.$setLevel(logLevel, resource)));
	}

	$log(file: UriComponents, messages: [LogLevel, string][]): void {
		const logger = this.loggerService.getLogger(URI.revive(file));
		if (!logger) {
			throw new Error('Create the logger before logging');
		}
		for (const [level, message] of messages) {
			log(logger, level, message);
		}
	}

	async $createLogger(file: UriComponents, options?: ILoggerOptions): Promise<void> {
		this.loggerService.createLogger(URI.revive(file), options, true /* do not register the loggers from the extension host */);
	}

	dispose(): void {
		this.disposables.dispose();
	}
}

// --- Internal commands to improve extension test runs

CommandsRegistry.registerCommand('_extensionTests.setLogLevel', function (accessor: ServicesAccessor, level: string) {
	const logService = accessor.get(ILogService);
	const environmentService = accessor.get(IEnvironmentService);

	if (environmentService.isExtensionDevelopment && !!environmentService.extensionTestsLocationURI) {
		const logLevel = parseLogLevel(level);
		if (logLevel !== undefined) {
			logService.setLevel(logLevel);
		}
	}
});

CommandsRegistry.registerCommand('_extensionTests.getLogLevel', function (accessor: ServicesAccessor) {
	const logService = accessor.get(ILogService);

	return LogLevelToString(logService.getLevel());
});
