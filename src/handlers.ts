import 'reflect-metadata';
import { jsonObject, jsonMember, JsonTypes, toJson, TypedJSON } from 'typedjson';
import { IAM } from 'aws-sdk';
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

@jsonObject
@toJson
class PasswordPolicy extends ResourceModel implements IAM.UpdateAccountPasswordPolicyRequest {

    ResourceId: Optional<string>;
    
    @jsonMember
    MinimumPasswordLength: Optional<number>;
    @jsonMember
    RequireSymbols: Optional<boolean>;
    @jsonMember
    RequireNumbers: Optional<boolean>;
    @jsonMember
    RequireUppercaseCharacters: Optional<boolean>;
    @jsonMember
    RequireLowercaseCharacters: Optional<boolean>;
    @jsonMember
    AllowUsersToChangePassword: Optional<boolean>;
    
    ExpirePasswords: Optional<boolean>;
    
    @jsonMember
    MaxPasswordAge: Optional<number>;
    @jsonMember
    PasswordReusePrevention: Optional<number>;
    @jsonMember
    HardExpiry: Optional<boolean>;

    public static fromObject(input: object): PasswordPolicy {
        const serializer = new TypedJSON(PasswordPolicy);
        return serializer.parse(input);
    }

    public toObject(): JsonTypes {
        const serializer = new TypedJSON(PasswordPolicy);
        return serializer.toPlainJson(this);
    }
};


const retrievePasswordPolicy = async (
    session: SessionProxy,
    resourceId: Optional<string>,
    logicalResourceIdentifier: Optional<string>
): Promise<PasswordPolicy> => {
    let model: PasswordPolicy = null;
    try {
        if (session instanceof SessionProxy) {
            const client = session.client('IAM') as IAM;
            const response = await client.getAccountPasswordPolicy().promise();
            LOGGER.debug('getAccountPasswordPolicy response', response);
            model = PasswordPolicy.fromObject(response);
            model.ResourceId = resourceId || logicalResourceIdentifier;
            LOGGER.info(`${PasswordPolicy.TYPE_NAME} [${model.ResourceId}] [${logicalResourceIdentifier}] successfully retrieved.`);
        }
    } catch(err) {
        LOGGER.log(err);
        if (err && err.code === 'NoSuchEntity') {
            throw new exceptions.NotFound(PasswordPolicy.TYPE_NAME, model.ResourceId || logicalResourceIdentifier);
        } else { // Raise the original exception
            throw err;
        }
    }
    return Promise.resolve(model);
};

const upsertPasswordPolicy = async (
    session: SessionProxy,
    model: PasswordPolicy,
    logicalResourceIdentifier: Optional<string>
): Promise<PasswordPolicy> => {
    try {
        if (session instanceof SessionProxy) {
            const client = session.client('IAM') as IAM;
            if (!model.ResourceId) {
                model.ResourceId = uuidv4();
            }
            const params = model.toObject() as IAM.UpdateAccountPasswordPolicyRequest;
            const response = await client.updateAccountPasswordPolicy(params).promise();
            LOGGER.debug('updateAccountPasswordPolicy response', response);
            LOGGER.info(`${PasswordPolicy.TYPE_NAME} [${model.ResourceId}] [${logicalResourceIdentifier}] successfully upserted.`);
        }
    } catch(err) {
        LOGGER.log(err);
        throw new exceptions.InternalFailure(err.message);
    }
    return Promise.resolve(model);
}

class Resource extends BaseResource<ResourceModel> {

    @handlerEvent(Action.Create)
    public async create(
        session: Optional<SessionProxy>,
        request: ResourceHandlerRequest<ResourceModel>,
        callbackContext: Map<string, any>
    ): Promise<ProgressEvent> {
        LOGGER.debug('CREATE request', request);
        let model: PasswordPolicy = PasswordPolicy.fromObject(request.desiredResourceState);
        LOGGER.debug('CREATE model', model);
        const progress: ProgressEvent<PasswordPolicy> = ProgressEvent.builder()
            .status(OperationStatus.InProgress)
            .resourceModel(model)
            .build() as ProgressEvent<PasswordPolicy>;
        LOGGER.debug('CREATE this', this);
        model = await upsertPasswordPolicy(session, model, request.logicalResourceIdentifier);
        progress.resourceModel = model;
        progress.status = OperationStatus.Success;
        LOGGER.log('CREATE progress', progress.toObject());
        return progress;
    }

    @handlerEvent(Action.Update)
    public async update(
        session: Optional<SessionProxy>,
        request: ResourceHandlerRequest<ResourceModel>,
        callbackContext: Map<string, any>
    ): Promise<ProgressEvent> {
        LOGGER.debug('UPDATE request', request);
        let model: PasswordPolicy = PasswordPolicy.fromObject(request.desiredResourceState);
        const progress: ProgressEvent<PasswordPolicy> = ProgressEvent.builder()
            .status(OperationStatus.InProgress)
            .resourceModel(model)
            .build() as ProgressEvent<PasswordPolicy>;
        model = await upsertPasswordPolicy(session, model, request.logicalResourceIdentifier);
        progress.resourceModel = model;
        progress.status = OperationStatus.Success;
        LOGGER.log('UPDATE progress', progress.toObject());
        return progress;
    }

    @handlerEvent(Action.Delete)
    public async delete(
        session: Optional<SessionProxy>,
        request: ResourceHandlerRequest<ResourceModel>,
        callbackContext: Map<string, any>
    ): Promise<ProgressEvent> {
        LOGGER.debug('DELETE request', request);
        let model: PasswordPolicy = PasswordPolicy.fromObject(request.desiredResourceState);
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
                const response = await client.deleteAccountPasswordPolicy().promise;
                LOGGER.debug('updateAccountPasswordPolicy response', response);
                LOGGER.info(`${this.typeName} [${model.ResourceId}] [${request.logicalResourceIdentifier}] successfully deleted.`);
            }
        } catch(err) {
            LOGGER.log(err);
            throw new exceptions.InternalFailure(err.message);
        }
        progress.status = OperationStatus.Success;
        LOGGER.log('DELETE progress', progress.toObject());
        return progress;
    }

    @handlerEvent(Action.Read)
    public async read(
        session: Optional<SessionProxy>,
        request: ResourceHandlerRequest<ResourceModel>,
        callbackContext: Map<string, any>
    ): Promise<ProgressEvent> {
        LOGGER.debug('READ request', request);
        const model: PasswordPolicy = await retrievePasswordPolicy(
            session,
            request.desiredResourceState.ResourceId,
            request.logicalResourceIdentifier
        );
        const progress: ProgressEvent<PasswordPolicy> = ProgressEvent.builder()
            .status(OperationStatus.Success)
            .resourceModel(model)
            .build() as ProgressEvent<PasswordPolicy>;
        LOGGER.log('READ progress', progress.toObject());
        return progress;
    }

    @handlerEvent(Action.List)
    public async list(
        session: Optional<SessionProxy>,
        request: ResourceHandlerRequest<ResourceModel>,
        callbackContext: Map<string, any>
    ): Promise<ProgressEvent> {
        LOGGER.debug('LIST request', request);
        const model: PasswordPolicy = await retrievePasswordPolicy(
            session,
            request.desiredResourceState.ResourceId,
            request.logicalResourceIdentifier
        );
        const progress: ProgressEvent<PasswordPolicy> = ProgressEvent.builder()
            .status(OperationStatus.Success)
            .resourceModels([model])
            .build() as ProgressEvent<PasswordPolicy>;
        LOGGER.log('LIST progress', progress.toObject());
        return progress;
    }
}

const resource = new Resource(PasswordPolicy.TYPE_NAME, PasswordPolicy);

export const entrypoint = resource.entrypoint;

export const testEntrypoint = resource.testEntrypoint;
