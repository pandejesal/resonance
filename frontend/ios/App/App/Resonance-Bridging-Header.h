#ifndef Resonance_Bridging_Header_h
#define Resonance_Bridging_Header_h

#include <stdint.h>

extern void resonance_start(
    const char* database_url,
    const char* host,
    uint16_t port,
    const char* static_dir
);

#endif
