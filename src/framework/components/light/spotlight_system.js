pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.SpotLightComponentSystem
     * @constructor Create a new SpotLightComponentSystem
     * @class A Light Component is used to dynamically light the scene.
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var SpotLightComponentSystem = function (context) {
        this.id = "spotlight";
        context.systems.add(this.id, this);

        this.renderable = _createGfxResources();

        this.ComponentType = pc.fw.SpotLightComponent;
        this.DataType = pc.fw.SpotLightComponentData;

        this.schema = [{
            name: "enable",
            displayName: "Enable",
            description: "Enable or disable the light",
            type: "boolean",
            defaultValue: true
        }, {
            name: "color",
            displayName: "Color",
            description: "Light color",
            type: "rgb",
            defaultValue: "0xffffff"
        }, {
            name: "intensity",
            displayName: "Intensity",
            description: "Factors the light color",
            type: "number",
            defaultValue: 1,
            options: {
                min: 0,
                max: 10,
                step: 0.05
            }
        }, {
            name: "castShadows",
            displayName: "Cast shadows",
            description: "Cast shadows from this light",
            type: "boolean",
            defaultValue: false
        }, {
            name: "attenuationEnd",
            displayName: "Attenuation End",
            description: "The distance from the light where its contribution falls to zero",
            type: "number",
            defaultValue: 10,
            options: {
                min: 0
            }
        }, {
            name: "innerConeAngle",
            displayName: "Inner Cone Angle",
            description: "Spotlight inner cone angle",
            type: "number",
            defaultValue: 40,
            options: {
                min: 0,
                max: 90
            }
        }, {
            name: "outerConeAngle",
            displayName: "Outer Cone Angle",
            description: "Spotlight outer cone angle",
            type: "number",
            defaultValue: 45,
            options: {
                min: 0,
                max: 90
            }
        }, {
            name: "light",
            exposed: false
        }];

        this.exposeProperties();

        this.bind('remove', this.onRemove.bind(this));
        pc.fw.ComponentSystem.bind('toolsUpdate', this.toolsUpdate.bind(this));
    };
    SpotLightComponentSystem = pc.inherits(SpotLightComponentSystem, pc.fw.ComponentSystem);

    pc.extend(SpotLightComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            
            var light = new pc.scene.LightNode();
            light.setType(pc.scene.LightType.SPOT);

            data = data || {};
            data.light = light;

            properties = ['light', 'enable', 'color', 'intensity', 'castShadows', 'attenuationEnd', 'innerConeAngle', 'outerConeAngle'];
            SpotLightComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },
    
        onRemove: function (entity, data) {
            entity.removeChild(data.light);
            data.light.setEnabled(false);
            delete data.light;
        },

        toolsUpdate: function (fn) {
            var components = this.store;
            for (var id in components) {
                if (components.hasOwnProperty(id)) {
                    var entity = components[id].entity;
                    var componentData = components[id].data;

                    this.context.scene.enqueue('opaque', function (renderable, light, transform) {
                        return function () {
                            var program = renderable.program;
                            var indexBuffer = renderable.indexBuffer;
                            var vertexBuffer = renderable.vertexBuffer;

                            var oca = Math.PI * light.getOuterConeAngle() / 180;
                            var ae = light.getAttenuationEnd();
                            var y = -ae * Math.cos(oca);
                            var r = ae * Math.sin(oca);

                            var positions = new Float32Array(vertexBuffer.lock());
                            positions[0] = 0;
                            positions[1] = 0;
                            positions[2] = 0;
                            var numVerts = vertexBuffer.getNumVertices();
                            for (var i = 0; i < numVerts-1; i++) {
                                var theta = 2 * Math.PI * (i / (numVerts-2));
                                var x = r * Math.cos(theta);
                                var z = r * Math.sin(theta);
                                positions[(i+1)*3+0] = x;
                                positions[(i+1)*3+1] = y;
                                positions[(i+1)*3+2] = z;
                            }
                            vertexBuffer.unlock();

                            // Render a representation of the light
                            var device = pc.gfx.Device.getCurrent();
                            device.setProgram(program);
                            device.setIndexBuffer(indexBuffer);
                            device.setVertexBuffer(vertexBuffer, 0);

                            device.scope.resolve("matrix_model").setValue(transform);
                            var c = light.getColor();
                            device.scope.resolve("uColor").setValue([c[0], c[1], c[2], 1]);
                            device.draw({
                                type: pc.gfx.PrimType.LINES,
                                base: 0,
                                count: indexBuffer.getNumIndices(),
                                indexed: true
                            });                            
                        }
                    }(this.renderable, componentData.light, entity.getWorldTransform()));
                }
            }
        },

        onSetAttenuationEnd: function (entity, name, oldValue, newValue) {
            if (newValue) {
                var componentData = this.getComponentData(entity);
                componentData.light.setAttenuationEnd(newValue);
            }
        },

        onSetCastShadows: function (entity, name, oldValue, newValue) {
            if (newValue !== undefined) {
                var componentData = this.getComponentData(entity);
                componentData.light.setCastShadows(newValue);
            }
        },

        onSetColor: function (entity, name, oldValue, newValue) {
            if (newValue) {
                var componentData = this.getComponentData(entity);
                var rgb = parseInt(newValue);
                rgb = pc.math.intToBytes24(rgb);
                var color = [
                    rgb[0] / 255,
                    rgb[1] / 255,
                    rgb[2] / 255
                ];
                componentData.light.setColor(color);
            }
        },

        onSetInnerConeAngle: function (entity, name, oldValue, newValue) {
            if (newValue !== undefined) {
                var componentData = this.getComponentData(entity);
                componentData.light.setInnerConeAngle(newValue);
            }
        },

        onSetOuterConeAngle: function (entity, name, oldValue, newValue) {
            if (newValue !== undefined) {
                var componentData = this.getComponentData(entity);
                componentData.light.setOuterConeAngle(newValue);
            }
        },

        onSetEnable: function (entity, name, oldValue, newValue) {
            if (newValue !== undefined) {
                var componentData = this.getComponentData(entity);
                componentData.light.setEnabled(newValue);
            }
        },

        onSetIntensity: function (entity, name, oldValue, newValue) {
            if (newValue !== undefined) {
                var componentData = this.getComponentData(entity);
                componentData.light.setIntensity(newValue);
            }
        },

        onSetLight: function (entity, name, oldValue, newValue) {
            if (oldValue) {
                entity.removeChild(oldValue);
                this.context.scene.removeLight(oldValue);
            }
            if (newValue) {
                entity.addChild(newValue);
                this.context.scene.addLight(newValue);
            }
        }
    });

    var _createGfxResources = function () {
        // Create the graphical resources required to render a light
        var device = pc.gfx.Device.getCurrent();
        var library = device.getProgramLibrary();
        var program = library.getProgram("basic", { vertexColors: false, diffuseMap: false });
        var format = new pc.gfx.VertexFormat();
        format.begin();
        format.addElement(new pc.gfx.VertexElement("vertex_position", 3, pc.gfx.VertexElementType.FLOAT32));
        format.end();
        var vertexBuffer = new pc.gfx.VertexBuffer(format, 42, pc.gfx.VertexBufferUsage.DYNAMIC);
        var indexBuffer = new pc.gfx.IndexBuffer(pc.gfx.IndexFormat.UINT8, 88);
        var inds = new Uint8Array(indexBuffer.lock());
        // Spot cone side lines
        inds[0] = 0;
        inds[1] = 1;
        inds[2] = 0;
        inds[3] = 11;
        inds[4] = 0;
        inds[5] = 21;
        inds[6] = 0;
        inds[7] = 31;
        // Spot cone circle - 40 segments
        for (var i = 0; i < 40; i++) {
            inds[8 + i * 2 + 0] = i + 1;
            inds[8 + i * 2 + 1] = i + 2;
        }
        indexBuffer.unlock();

        // Set the resources on the component
        return {
            program: program,
            vertexBuffer: vertexBuffer,
            indexBuffer: indexBuffer
        };
    };

    return {
        SpotLightComponentSystem: SpotLightComponentSystem
    }; 
}());