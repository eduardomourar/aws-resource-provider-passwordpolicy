import 'reflect-metadata';
import {
    jsonObject,
    jsonMember,
    toJson,
    TypedJSON,
} from 'typedjson';
import { config, IAM } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import {
    Action,
    BaseResource,
    exceptions,
    handlerEvent,
    OperationStatus,
    Optional,
    ProgressEvent,
    ResourceHandlerRequest,
    SessionProxy,
} from 'cfn-rpdk';

import { ResourceModel } from './models';

// Use this logger to forward log messages to CloudWatch Logs.
const LOGGER = console;

/*
// The following can be used for debugging AWS SDK
config.logger = LOGGER;
Error.stackTraceLimit = Infinity;
*/

const parseBoolean = (value: string | boolean): boolean => {
    if (value !== undefined && value !== null) {
        return !!JSON.parse(String(value).toLowerCase());
    }
};

const parseInteger = (value: string | number): number => {
    if (value !== undefined && value !== null) {
        if (typeof value === 'string') {
            return Number.parseInt(value, 10);
        } else if (typeof value === 'number') {
            return Math.trunc(value);
        }
    }
};

@jsonObject
@toJson
class PasswordPolicy extends ResourceModel {

    @jsonMember({ constructor: String })
    ResourceId: Optional<string>;
    @jsonMember({ deserializer: parseInteger, constructor: Number })
    MinimumPasswordLength: Optional<number>;
    @jsonMember({ deserializer: parseBoolean, constructor: Boolean })
    RequireSymbols: Optional<boolean>;
    @jsonMember({ deserializer: parseBoolean, constructor: Boolean })
    RequireNumbers: Optional<boolean>;
    @jsonMember({ deserializer: parseBoolean, constructor: Boolean })
    RequireUppercaseCharacters: Optional<boolean>;
    @jsonMember({ deserializer: parseBoolean, constructor: Boolean })
    RequireLowercaseCharacters: Optional<boolean>;
    @jsonMember({ deserializer: parseBoolean, constructor: Boolean })
    AllowUsersToChangePassword: Optional<boolean>;
    ExpirePasswords: Optional<boolean>;
    @jsonMember({ deserializer: parseInteger, constructor: Number })
    MaxPasswordAge: Optional<number>;
    @jsonMember({ deserializer: parseInteger, constructor: Number })
    PasswordReusePrevention: Optional<number>;
    @jsonMember({ deserializer: parseBoolean, constructor: Boolean })
    HardExpiry: Optional<boolean>;

    public static fromObject(input: object): PasswordPolicy {
        const serializer = new TypedJSON(PasswordPolicy);
        return serializer.parse(input);
    }

    public toObject(): any {
        const serializer = new TypedJSON(PasswordPolicy);
        return JSON.parse(JSON.stringify(serializer.toPlainJson(this)));
    }
}

/**
 * Retrieves the password policy for the AWS account.
 * 
 * @param session Current AWS session passed through from caller
 * @param resourceId The resource unique identifier
 * @param logicalResourceId The logical name of the resource as specified
 * in the template
 */
const retrievePasswordPolicy = async (
    session: SessionProxy,
    resourceId: Optional<string>,
    logicalResourceId: Optional<string>
): Promise<PasswordPolicy> => {
    let model: PasswordPolicy = null;
    try {
        if (session instanceof SessionProxy) {
            const client = session.client('IAM') as IAM;
            const response = await client.getAccountPasswordPolicy().promise();
            // LOGGER.debug('getAccountPasswordPolicy response', response);
            model = PasswordPolicy.fromObject(response.PasswordPolicy);
            model.ResourceId = resourceId || logicalResourceId;
            LOGGER.info(
                PasswordPolicy.TYPE_NAME,
                `[${model.ResourceId}] [${logicalResourceId}]`,
                'successfully retrieved.'
            );
        }
    } catch(err) {
        LOGGER.log(err);
        if (err && err.code === 'NoSuchEntity') {
            throw new exceptions.NotFound(
                PasswordPolicy.TYPE_NAME,
                resourceId || logicalResourceId
            );
        } else { // Raise the original exception
            throw err;
        }
    }
    return Promise.resolve(model);
};

/**
 * Updates or insert the password policy settings for the AWS account. This operation does not
 * support partial updates. No parameters are required, but if you do not specify a
 * parameter, that parameter's value reverts to its default value.
 * 
 * @param session Current AWS session passed through from caller
 * @param model The updated options for the password policy
 * @param logicalResourceId The logical name of the resource as specified
 * in the template
 */
const upsertPasswordPolicy = async (
    session: SessionProxy,
    model: PasswordPolicy,
    logicalResourceId: Optional<string>
): Promise<PasswordPolicy> => {
    try {
        if (session instanceof SessionProxy) {
            const client = session.client('IAM') as IAM;
            const params = model.toObject();
            delete params['ResourceId'];
            // LOGGER.debug('updateAccountPasswordPolicy params', params);
            const response = await client.updateAccountPasswordPolicy(params).promise();
            // LOGGER.debug('updateAccountPasswordPolicy response', response);
            if (!model.ResourceId) {
                model.ResourceId = uuidv4();
            }
            LOGGER.info(
                PasswordPolicy.TYPE_NAME,
                `[${model.ResourceId}] [${logicalResourceId}]`,
                'successfully upserted.'
            );
        }
    } catch(err) {
        LOGGER.log(err);
        throw new exceptions.InternalFailure(err.message);
    }
    return Promise.resolve(model);
}

class Resource extends BaseResource<ResourceModel> {

    /**
     * CloudFormation invokes this handler when the resource is initially created
     * during stack create operations.
     * 
     * @param session Current AWS session passed through from caller
     * @param request The request object for the provisioning request passed to the implementor
     * @param callbackContext Custom context object to enable handlers to process re-invocation
     */
    @handlerEvent(Action.Create)
    public async create(
        session: Optional<SessionProxy>,
        request: ResourceHandlerRequest<ResourceModel>,
        callbackContext: Map<string, any>
    ): Promise<ProgressEvent> {
        request.desiredResourceState = PasswordPolicy.fromObject(request.desiredResourceState);
        request.previousResourceState = PasswordPolicy.fromObject(request.previousResourceState);
        // LOGGER.debug('CREATE request', request);
        let model: PasswordPolicy = request.desiredResourceState;
        const progress: ProgressEvent<PasswordPolicy> = ProgressEvent.builder()
            .status(OperationStatus.InProgress)
            .resourceModel(model)
            .build() as ProgressEvent<PasswordPolicy>;
        model = await upsertPasswordPolicy(session, model, request.logicalResourceIdentifier);
        progress.resourceModel = model;
        progress.status = OperationStatus.Success;
        LOGGER.info('CREATE progress', progress.toObject());
        return progress;
    }

    /**
     * CloudFormation invokes this handler when the resource is updated
     * as part of a stack update operation.
     * 
     * @param session Current AWS session passed through from caller
     * @param request The request object for the provisioning request passed to the implementor
     * @param callbackContext Custom context object to enable handlers to process re-invocation
     */
    @handlerEvent(Action.Update)
    public async update(
        session: Optional<SessionProxy>,
        request: ResourceHandlerRequest<ResourceModel>,
        callbackContext: Map<string, any>
    ): Promise<ProgressEvent> {
        request.desiredResourceState = PasswordPolicy.fromObject(request.desiredResourceState);
        request.previousResourceState = PasswordPolicy.fromObject(request.previousResourceState);
        // LOGGER.debug('UPDATE request', request);
        let model: PasswordPolicy = request.desiredResourceState;
        const progress: ProgressEvent<PasswordPolicy> = ProgressEvent.builder()
            .status(OperationStatus.InProgress)
            .resourceModel(model)
            .build() as ProgressEvent<PasswordPolicy>;
        await retrievePasswordPolicy(
            session,
            model.ResourceId,
            request.logicalResourceIdentifier
        );
        model = await upsertPasswordPolicy(session, model, request.logicalResourceIdentifier);
        // LOGGER.debug('UPDATE model', model);
        progress.resourceModel = model;
        progress.status = OperationStatus.Success;
        // progress.callbackContext = new Map<string, any>();
        // callbackContext.set('RequestId', 'e9899120-8e56-11ea-bfb5-02722d612c06');
        LOGGER.info('UPDATE progress', progress.toObject());
        return progress;
    }

    /**
     * CloudFormation invokes this handler when the resource is deleted, either when
     * the resource is deleted from the stack as part of a stack update operation,
     * or the stack itself is deleted.
     * 
     * @param session Current AWS session passed through from caller
     * @param request The request object for the provisioning request passed to the implementor
     * @param callbackContext Custom context object to enable handlers to process re-invocation
     */
    @handlerEvent(Action.Delete)
    public async delete(
        session: Optional<SessionProxy>,
        request: ResourceHandlerRequest<ResourceModel>,
        callbackContext: Map<string, any>
    ): Promise<ProgressEvent> {
        request.desiredResourceState = PasswordPolicy.fromObject(request.desiredResourceState);
        request.previousResourceState = PasswordPolicy.fromObject(request.previousResourceState);
        // LOGGER.debug('DELETE request', request);
        let model: PasswordPolicy = request.desiredResourceState;
        const progress: ProgressEvent<PasswordPolicy> = ProgressEvent.builder()
            .status(OperationStatus.InProgress)
            .resourceModel(model)
            .build() as ProgressEvent<PasswordPolicy>;
        model = await retrievePasswordPolicy(
            session,
            model.ResourceId,
            request.logicalResourceIdentifier
        );
        try {
            if (session instanceof SessionProxy) {
                const client = session.client('IAM') as IAM;
                const response = await client.deleteAccountPasswordPolicy().promise();
                // LOGGER.debug('deleteAccountPasswordPolicy response', response);
                LOGGER.info(
                    this.typeName,
                    `[${model.ResourceId}] [${request.logicalResourceIdentifier}]`,
                    'successfully deleted.'
                );
            }
        } catch(err) {
            LOGGER.log(err);
            throw new exceptions.InternalFailure(err.message);
        }
        progress.status = OperationStatus.Success;
        LOGGER.info('DELETE progress', progress.toObject());
        return progress;
    }

    /**
     * CloudFormation invokes this handler as part of a stack update operation when
     * detailed information about the resource's current state is required.
     * 
     * @param session Current AWS session passed through from caller
     * @param request The request object for the provisioning request passed to the implementor
     * @param callbackContext Custom context object to enable handlers to process re-invocation
     */
    @handlerEvent(Action.Read)
    public async read(
        session: Optional<SessionProxy>,
        request: ResourceHandlerRequest<ResourceModel>,
        callbackContext: Map<string, any>
    ): Promise<ProgressEvent> {
        request.desiredResourceState = PasswordPolicy.fromObject(request.desiredResourceState);
        request.previousResourceState = PasswordPolicy.fromObject(request.previousResourceState);
        // LOGGER.debug('READ request', request);
        const model: PasswordPolicy = await retrievePasswordPolicy(
            session,
            request.desiredResourceState.ResourceId,
            request.logicalResourceIdentifier
        );
        const progress: ProgressEvent<PasswordPolicy> = ProgressEvent.builder()
            .status(OperationStatus.Success)
            .resourceModel(model)
            .build() as ProgressEvent<PasswordPolicy>;
        LOGGER.info('READ progress', progress.toObject());
        return progress;
    }

    /**
     * CloudFormation invokes this handler when summary information about multiple
     * resources of this resource provider is required.
     * 
     * @param session Current AWS session passed through from caller
     * @param request The request object for the provisioning request passed to the implementor
     * @param callbackContext Custom context object to enable handlers to process re-invocation
     */
    @handlerEvent(Action.List)
    public async list(
        session: Optional<SessionProxy>,
        request: ResourceHandlerRequest<ResourceModel>,
        callbackContext: Map<string, any>
    ): Promise<ProgressEvent> {
        request.desiredResourceState = PasswordPolicy.fromObject(request.desiredResourceState);
        request.previousResourceState = PasswordPolicy.fromObject(request.previousResourceState);
        // LOGGER.debug('LIST request', request);
        const models: Array<PasswordPolicy> = [];
        try {
            const model: PasswordPolicy = await retrievePasswordPolicy(
                session,
                request.desiredResourceState.ResourceId,
                request.logicalResourceIdentifier
            );
            models.push(model);
        } catch(err) {
            if (!(err instanceof exceptions.NotFound)) {
                throw err;
            }
        }
        const progress: ProgressEvent<PasswordPolicy> = ProgressEvent.builder()
            .status(OperationStatus.Success)
            .resourceModels(models)
            .build() as ProgressEvent<PasswordPolicy>;
        LOGGER.info('LIST progress', progress.toObject());
        return progress;
    }
}

const resource = new Resource(PasswordPolicy.TYPE_NAME, PasswordPolicy);

export const entrypoint = (...args: [any, any]) => {
    // LOGGER.debug('entrypoint input', ...args);
    return resource.entrypoint(...args);
}

export const testEntrypoint = (...args: [any, any]) => {
    // LOGGER.debug('testEntrypoint input', ...args);
    return resource.testEntrypoint(...args);
}
