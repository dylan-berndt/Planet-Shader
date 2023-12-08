#define PI 3.14159

#define PIXEL_SIZE 4.0

#define YSCALE 0.3

#define TOTAL_PLANETS 3

#define LIGHT_DIRECTION normalize(vec3(1, -0.5, 0.4))

struct Planet {
    vec2 position;
    float size;
    float rotation;
    float clouds;
    float offset;
    float[3] levels;
    vec3[4] colors;
    bool emitting;
    float bayer;
};

const vec3[4]  EARTH_COLORS =  vec3[4] (vec3(72, 74, 119), vec3(77, 101, 180), vec3(35, 144, 99), vec3(30, 188, 115));
const float[3] EARTH_LEVELS = float[3] (             0.35,               0.45,             0.53);

const vec3[4]  MOON_COLORS =  vec3[4] (vec3(69, 41, 63), vec3(107, 62, 117), vec3(127, 112, 128), vec3(155, 171, 178));
const float[3] MOON_LEVELS = float[3] (             0.3,                0.5,                0.6);

const vec3[4]  SUN_COLORS =  vec3[4] (vec3(245, 125, 74), vec3(285, 185, 84),  vec3(255, 231, 134), vec3(155, 171, 178));
const float[3] SUN_LEVELS = float[3] (               0.4,                0.5,                 1.0);

#define EARTH Planet(vec2(0.4,  0.5), 0.15, -0.2, 0.60, 0.0, EARTH_LEVELS, EARTH_COLORS, false,  0.0)
#define MOON  Planet(vec2(0.9,  0.8), 0.06, 0.15,  6.0, 0.5,  MOON_LEVELS,  MOON_COLORS, false,  0.0)
#define SUN   Planet(vec2(1.8, -0.6), 1.09, 0.10,  6.0, 0.0,   SUN_LEVELS,   SUN_COLORS,  true, 0.07)


Planet[TOTAL_PLANETS] PLANETS = Planet[] (EARTH, MOON, SUN);


vec3 spherePosition(vec2 uv, vec2 center, float size, float rotate) {
    // UV relative to center of planet
    vec2 zero = uv - center;
    
    // Rotate UV for more dynamic planets
    float angle = atan(zero.y, zero.x);
    angle += rotate;
    zero = length(zero) * vec2(cos(angle), sin(angle));
    
    // Localize UV to (-1, 1)
    vec2 local = zero / size;
    
    // Find z position on sphere from 1^2 = z^2 + y^2 + x^2
    float z = sqrt(1.0 - pow(local.x, 2.0) - pow(local.y, 2.0));
    
    vec3 position = vec3(local.x, local.y, z);
    
    return position;
}


vec2 transform(vec3 position, float offset, float size) {
    // Find xz distance from center of sphere
    float xzDist = sqrt(pow(position.x, 2.0) + pow(position.z, 2.0));
    
    // Project sphere point onto cylinder
    vec3 cylinder = position / xzDist;
    
    // Use angle of cylinder projection to find X coordinate on texture
    float x = atan(cylinder.x, cylinder.z) / (2.0 * PI) + iTime * 0.005 / size;
    // Y point can be taken directly from cylinder, 
    // but squished to prevent too much texture wrapping
    float y = cylinder.y * YSCALE + offset;
    
    return vec2(x, y);
}

// Both samplePerlin and sampleClouds just sample the textures
// at multiple zoom levels with multiple weights for large
// scale form and small scale detail
float samplePerlin(vec2 uv) {
    float[4] zoom    = float[] (0.1, 0.2, 0.6, 1.0);
    float[4] weights = float[] (0.4, 0.3, 0.2, 0.1);
    
    float value = 0.0;
    
    for (int i = 0; i < 4; i++) {
        value += texture(iChannel0, uv * zoom[i]).x * weights[i];
    }
    
    return value;
}

float sampleClouds(vec2 uv) {
    float[2] zoom    = float[] (0.1, 1.0);
    float[2] weights = float[] (0.4, 0.6);
    
    float value = 0.0;
    
    for (int i = 0; i < 4; i++) {
        vec4 cloud = texture(iChannel1, uv * zoom[i]);
        float v = (cloud.x + cloud.y + cloud.z) / 3.0;
        value += v * weights[i];
    }
    
    return value;
}

// Compute intersection of UV point with planet, and determine color
// according to value of perlin sample and color levels
vec3 planet(vec2 uv, Planet planet) {
    float dist = distance(uv, planet.position);
    
    if (dist < planet.size) {
        vec3 sphere = spherePosition(uv, planet.position, planet.size, planet.rotation);
        vec2 transformed = transform(sphere, planet.offset, planet.size);
        
        float value = samplePerlin(transformed.xy);
        float bayer = texture(iChannel2, uv * (iResolution.y / (PIXEL_SIZE * 8.0))).x;
        value += planet.bayer * bayer - planet.bayer / 2.0;
        
        vec3 col = planet.colors[3] / 255.0;
        for (int i = 0; i < 3; i++) {
            if (value < planet.levels[i]) {
                col = planet.colors[i] / 255.0;
                break;
            }
        }
        
        float cloud = sampleClouds(transformed.xy);

        if (cloud > planet.clouds) {
            col = vec3(0.8, 0.8, 0.8);
        }
        
        float lighting = dot(LIGHT_DIRECTION, sphere) / 2.0 + 0.5;
        
        if (!planet.emitting) {
            col *= lighting;
        }
        else {
            col *= lighting + 1.0;
        }
        
        return col;
    }
    else {
        return vec3(0, 0, 0);
    }
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    //float PIXEL_SIZE = floor(iResolution.y / IMAGE_HEIGHT);
    vec2 uv = floor(fragCoord / PIXEL_SIZE) * PIXEL_SIZE / iResolution.y;
    
    vec3 col = vec3(0, 0, 0);
    for (int i = 0; i < TOTAL_PLANETS; i++) {
        col += planet(uv, PLANETS[i]);
    }

    fragColor = vec4(col, 1);
}
